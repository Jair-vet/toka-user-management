import logging
from langchain_core.messages import AIMessage
from .tools.user_lookup import user_lookup
from .tools.audit_search import audit_search
from ..prompts.system_prompts import REPORT_AGENT_PROMPT
from ..infrastructure.llm.provider import get_chat_model
from ..infrastructure.observability import traced_observation
from .trace_state import append_agent_path, append_tool_call

logger = logging.getLogger(__name__)
AGENT_NAME = "report_agent"


async def report_agent_node(state: dict) -> dict:
    """Report Agent: fetches live data and generates structured reports."""
    query = state["messages"][-1].content
    trace_id = state.get("trace_id")

    # Gather data from multiple sources
    tool_results = []
    tool_calls = state.get("tool_calls", [])

    try:
        with traced_observation(
            trace_id=trace_id,
            name=f"{AGENT_NAME}.user_lookup",
            input_data={"query": query},
            metadata={"agent": AGENT_NAME, "tool": "user_lookup"},
        ):
            user_data = await user_lookup.ainvoke({"query": query})
        tool_results.append({"tool": "user_lookup", "result": user_data})
        tool_calls = append_tool_call(state, agent_name=AGENT_NAME, tool_name="user_lookup", ok=True)
    except Exception as e:
        logger.warning(f"user_lookup failed: {e}")
        tool_calls = append_tool_call(
            {"tool_calls": tool_calls},
            agent_name=AGENT_NAME,
            tool_name="user_lookup",
            ok=False,
            error=str(e),
        )

    try:
        with traced_observation(
            trace_id=trace_id,
            name=f"{AGENT_NAME}.audit_search",
            input_data={"query": "limit=5"},
            metadata={"agent": AGENT_NAME, "tool": "audit_search"},
        ):
            audit_data = await audit_search.ainvoke({"query": "limit=5"})
        tool_results.append({"tool": "audit_search", "result": audit_data})
        tool_calls = append_tool_call(
            {"tool_calls": tool_calls},
            agent_name=AGENT_NAME,
            tool_name="audit_search",
            ok=True,
        )
    except Exception as e:
        logger.warning(f"audit_search failed: {e}")
        tool_calls = append_tool_call(
            {"tool_calls": tool_calls},
            agent_name=AGENT_NAME,
            tool_name="audit_search",
            ok=False,
            error=str(e),
        )

    # Format tool results as context
    context = "\n\n".join([f"[{r['tool']}]:\n{r['result']}" for r in tool_results])

    # Generate report with LLM
    llm = get_chat_model(max_tokens=450, temperature=0)

    messages = [
        {"role": "system", "content": REPORT_AGENT_PROMPT},
        {
            "role": "user",
            "content": (
                f"Query: {query}\n\nAvailable data:\n{context}\n\n"
                "Responde en espanol, directo y con maximo 8 bullets."
            ),
        },
    ]

    with traced_observation(
        trace_id=trace_id,
        name=f"{AGENT_NAME}.generation",
        input_data={"messages": messages},
        metadata={"agent": AGENT_NAME, "tool_results_count": len(tool_results)},
    ):
        response = await llm.ainvoke(messages)
    answer = response.content

    return {
        **state,
        "messages": state["messages"] + [AIMessage(content=answer)],
        "tool_results": tool_results,
        "agent_path": append_agent_path(state, AGENT_NAME),
        "tool_calls": tool_calls,
        "agent_outputs": {
            **state.get("agent_outputs", {}),
            AGENT_NAME: answer,
        },
        "final_answer": answer,
    }
