"""
LangGraph multi-agent orchestrator with supervisor pattern.

Graph topology:
  [START]
     │
  supervisor ──→ frontend_agent ──┐
             ──→ backend_agent   ──┤──→ supervisor (loop)
             ──→ database_agent  ──┤
             ──→ rag_agent       ──┤
             ──→ report_agent    ──┤
             ──→ FINISH ──────────┘──→ [END]

The supervisor decides which specialist to invoke next.
After each specialist runs, control returns to the supervisor.
When the supervisor outputs FINISH, the graph ends.
"""
import logging
import time
import uuid
from typing import Annotated, TypedDict
from langgraph.graph import StateGraph, END
from langgraph.graph.message import add_messages
from langchain_core.messages import HumanMessage, BaseMessage

from .supervisor import supervisor_node, route_supervisor
from .rag_agent import rag_agent_node
from .report_agent import report_agent_node
from .admin_assistant import admin_assistant_node
from .frontend_agent import frontend_agent_node
from .backend_agent import backend_agent_node
from .database_agent import database_agent_node
from ..config import settings
from ..evaluation.metrics import track_metrics
from .auth_context import reset_access_token, set_access_token
from ..infrastructure.llm.provider import get_llm_metadata, is_llm_configured
from ..infrastructure.observability import finish_trace, start_trace, update_trace

logger = logging.getLogger(__name__)


class AgentState(TypedDict):
    messages: Annotated[list[BaseMessage], add_messages]
    intent: str
    context: list[dict]
    tool_results: list[dict]
    final_answer: str
    metadata: dict
    # Supervisor fields
    next_agent: str
    agent_outputs: dict
    supervisor_rounds: int
    supervisor_max_rounds: int
    trace_id: str
    agent_path: list[str]
    routing_decisions: list[dict]
    tool_calls: list[dict]
    errors: list[dict]
    model_metadata: dict


def build_graph() -> StateGraph:
    """Build the LangGraph supervisor-based state machine."""
    workflow = StateGraph(AgentState)

    # ── Nodes ────────────────────────────────────────────────────────────────
    workflow.add_node("supervisor",      supervisor_node)
    workflow.add_node("rag_agent",       rag_agent_node)
    workflow.add_node("report_agent",    report_agent_node)
    workflow.add_node("admin_assistant", admin_assistant_node)
    workflow.add_node("frontend_agent",  frontend_agent_node)
    workflow.add_node("backend_agent",   backend_agent_node)
    workflow.add_node("database_agent",  database_agent_node)

    # ── Entry point ───────────────────────────────────────────────────────────
    workflow.set_entry_point("supervisor")

    # ── Supervisor → workers (conditional) ───────────────────────────────────
    workflow.add_conditional_edges(
        "supervisor",
        route_supervisor,
        {
            "frontend_agent":  "frontend_agent",
            "backend_agent":   "backend_agent",
            "database_agent":  "database_agent",
            "rag_agent":       "rag_agent",
            "report_agent":    "report_agent",
            "admin_assistant": "admin_assistant",
            "FINISH":          END,
        },
    )

    # ── Workers → supervisor (all loop back) ──────────────────────────────────
    for node in (
        "frontend_agent", "backend_agent", "database_agent",
        "rag_agent", "report_agent", "admin_assistant",
    ):
        workflow.add_edge(node, "supervisor")

    return workflow.compile()


# Singleton
_graph = None


def get_graph():
    global _graph
    if _graph is None:
        _graph = build_graph()
    return _graph


async def run_agent(
    message: str,
    session_id: str,
    user_id: str,
    access_token: str | None = None,
) -> dict:
    """Run the full multi-agent pipeline and return response + metrics."""
    start_time = time.time()
    trace_id = str(uuid.uuid4())
    access_token_ctx = set_access_token(access_token)
    model_metadata = get_llm_metadata()

    start_trace(
        trace_id=trace_id,
        name="toka-ai-chat",
        user_id=user_id,
        session_id=session_id,
        input_data={"message": message},
        metadata={
            "service": "ai-agent-service",
            **model_metadata,
        },
    )

    try:
        if not is_llm_configured():
            latency_ms = int((time.time() - start_time) * 1000)
            answer = (
                "AI service is running in degraded local mode because no LLM provider is configured. "
                "Set AI_PROVIDER=ollama with OLLAMA_BASE_URL, or configure OPENAI_API_KEY, then restart the AI service."
            )
            await track_metrics(
                user_id=user_id,
                session_id=session_id,
                intent="degraded_no_llm_provider",
                latency_ms=latency_ms,
                metadata={"degraded": True, "reason": "missing_llm_provider"},
            )
            update_trace(
                trace_id=trace_id,
                output={"answer": answer},
                metadata={
                    "degraded": True,
                    "reason": "missing_llm_provider",
                    "latency_ms": latency_ms,
                    **model_metadata,
                },
                tags=["degraded", "missing-llm-provider"],
            )
            return {
                "answer": answer,
                "intent": "degraded_no_llm_provider",
                "latency_ms": latency_ms,
                "trace_id": trace_id,
            }

        graph = get_graph()

        initial_state: AgentState = {
            "messages": [HumanMessage(content=message)],
            "intent": "",
            "context": [],
            "tool_results": [],
            "final_answer": "",
            "metadata": {
                "user_id": user_id,
                "session_id": session_id,
                "trace_id": trace_id,
                **model_metadata,
            },
            "next_agent": "",
            "agent_outputs": {},
            "supervisor_rounds": 0,
            "supervisor_max_rounds": settings.supervisor_max_rounds,
            "trace_id": trace_id,
            "agent_path": [],
            "routing_decisions": [],
            "tool_calls": [],
            "errors": [],
            "model_metadata": model_metadata,
        }

        result = await graph.ainvoke(initial_state)

        latency_ms = int((time.time() - start_time) * 1000)
        final_answer = result.get("final_answer", "")

        # Derive intent from which agents were called
        agent_outputs: dict = result.get("agent_outputs", {})
        metadata: dict = result.get("metadata", {})
        model_metadata = {
            **model_metadata,
            **result.get("model_metadata", {}),
        }
        if metadata.get("ai_error"):
            intent = metadata["ai_error"]
        elif agent_outputs:
            intent = "+".join(agent_outputs.keys())
        else:
            intent = "unknown"

        enriched_metadata = {
            **metadata,
            **model_metadata,
            "trace_id": trace_id,
            "agent_path": result.get("agent_path", []),
            "routing_decisions": result.get("routing_decisions", []),
            "tool_calls": result.get("tool_calls", []),
            "errors": result.get("errors", []),
            "agent_outputs": agent_outputs,
            "supervisor_rounds": result.get("supervisor_rounds", 0),
        }

        await track_metrics(
            user_id=user_id,
            session_id=session_id,
            intent=intent,
            latency_ms=latency_ms,
            metadata=enriched_metadata,
        )

        update_trace(
            trace_id=trace_id,
            output={"answer": final_answer, "intent": intent},
            metadata={
                **enriched_metadata,
                "latency_ms": latency_ms,
            },
            tags=["ai-chat", intent],
        )

        return {
            "answer": final_answer,
            "intent": intent,
            "latency_ms": latency_ms,
            "trace_id": trace_id,
        }
    finally:
        finish_trace()
        reset_access_token(access_token_ctx)
