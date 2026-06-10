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


async def run_agent(message: str, session_id: str, user_id: str) -> dict:
    """Run the full multi-agent pipeline and return response + metrics."""
    start_time = time.time()

    if not settings.openai_api_key:
        latency_ms = int((time.time() - start_time) * 1000)
        answer = (
            "AI service is running in degraded local mode because OPENAI_API_KEY is not configured. "
            "Set OPENAI_API_KEY in docker/.env to enable LangGraph, RAG, embeddings, and tool reasoning."
        )
        await track_metrics(
            user_id=user_id,
            session_id=session_id,
            intent="degraded_no_openai_key",
            latency_ms=latency_ms,
            metadata={"degraded": True, "reason": "missing_openai_api_key"},
        )
        return {
            "answer": answer,
            "intent": "degraded_no_openai_key",
            "latency_ms": latency_ms,
        }

    graph = get_graph()

    initial_state: AgentState = {
        "messages": [HumanMessage(content=message)],
        "intent": "",
        "context": [],
        "tool_results": [],
        "final_answer": "",
        "metadata": {"user_id": user_id, "session_id": session_id},
        "next_agent": "",
        "agent_outputs": {},
        "supervisor_rounds": 0,
        "supervisor_max_rounds": settings.supervisor_max_rounds,
    }

    result = await graph.ainvoke(initial_state)

    latency_ms = int((time.time() - start_time) * 1000)
    final_answer = result.get("final_answer", "")

    # Derive intent from which agents were called
    agent_outputs: dict = result.get("agent_outputs", {})
    if agent_outputs:
        intent = "+".join(agent_outputs.keys())
    else:
        intent = "unknown"

    await track_metrics(
        user_id=user_id,
        session_id=session_id,
        intent=intent,
        latency_ms=latency_ms,
        metadata=result.get("metadata", {}),
    )

    return {
        "answer": final_answer,
        "intent": intent,
        "latency_ms": latency_ms,
    }
