"""Database Specialist Agent — PostgreSQL, MongoDB, Redis, Qdrant."""
import logging
from langchain_core.messages import AIMessage
from .tools.user_lookup import user_lookup
from .tools.audit_search import audit_search
from ..prompts.system_prompts import DATABASE_AGENT_PROMPT
from ..infrastructure.llm.provider import get_chat_model
from ..infrastructure.observability import traced_observation
from .trace_state import append_agent_path, append_tool_call

logger = logging.getLogger(__name__)

TOOLS = [user_lookup, audit_search]
AGENT_NAME = "database_agent"


async def database_agent_node(state: dict) -> dict:
    """Database agent: answers schema, query, and data model questions."""
    query = state["messages"][-1].content
    trace_id = state.get("trace_id")

    # Fetch live data samples to ground answers
    tool_results = []
    try:
        with traced_observation(
            trace_id=trace_id,
            name=f"{AGENT_NAME}.user_lookup",
            input_data={"query": "count"},
            metadata={"agent": AGENT_NAME, "tool": "user_lookup"},
        ):
            user_data = await user_lookup.ainvoke({"query": "count"})
        tool_results.append(f"Current user count: {user_data}")
        tool_calls = append_tool_call(state, agent_name=AGENT_NAME, tool_name="user_lookup", ok=True)
    except Exception as e:
        logger.warning(f"user_lookup failed in database_agent: {e}")
        tool_calls = append_tool_call(
            state,
            agent_name=AGENT_NAME,
            tool_name="user_lookup",
            ok=False,
            error=str(e),
        )

    context = "\n".join(tool_results) if tool_results else ""

    llm = get_chat_model(max_tokens=320, temperature=0)

    messages = [
        {
            "role": "system",
            "content": DATABASE_AGENT_PROMPT
            + (f"\n\nLive data:\n{context}" if context else ""),
        },
        {"role": "user", "content": f"{query}\n\nResponde en espanol, directo y con maximo 6 bullets."},
    ]

    with traced_observation(
        trace_id=trace_id,
        name=f"{AGENT_NAME}.generation",
        input_data={"messages": messages},
        metadata={"agent": AGENT_NAME, "live_data_used": bool(context)},
    ):
        response = await llm.ainvoke(messages)
    answer = response.content

    logger.info("database_agent produced answer")
    return {
        **state,
        "messages": state["messages"] + [AIMessage(content=answer)],
        "agent_path": append_agent_path(state, AGENT_NAME),
        "tool_calls": tool_calls,
        "agent_outputs": {
            **state.get("agent_outputs", {}),
            AGENT_NAME: answer,
        },
        "final_answer": answer,
    }
