"""Frontend Specialist Agent — React, Zustand, TanStack Query, design system."""
import logging
from langchain_core.messages import AIMessage
from .tools.vector_search import vector_search
from ..prompts.system_prompts import FRONTEND_AGENT_PROMPT
from ..infrastructure.llm.provider import get_chat_model
from ..infrastructure.observability import traced_observation
from .trace_state import append_agent_path, append_tool_call

logger = logging.getLogger(__name__)
AGENT_NAME = "frontend_agent"


async def frontend_agent_node(state: dict) -> dict:
    """Frontend agent: answers React/UI/design-system questions."""
    query = state["messages"][-1].content
    trace_id = state.get("trace_id")

    # Search docs for relevant frontend context
    context = ""
    try:
        with traced_observation(
            trace_id=trace_id,
            name=f"{AGENT_NAME}.vector_search",
            input_data={"query": query},
            metadata={"agent": AGENT_NAME, "tool": "vector_search"},
        ):
            context = await vector_search.ainvoke({"query": f"frontend React {query}"})
        tool_calls = append_tool_call(state, agent_name=AGENT_NAME, tool_name="vector_search", ok=True)
    except Exception as e:
        logger.warning(f"vector_search failed in frontend_agent: {e}")
        tool_calls = append_tool_call(
            state,
            agent_name=AGENT_NAME,
            tool_name="vector_search",
            ok=False,
            error=str(e),
        )

    llm = get_chat_model(max_tokens=320, temperature=0)

    messages = [
        {
            "role": "system",
            "content": FRONTEND_AGENT_PROMPT
            + (f"\n\nRelevant docs:\n{context}" if context else ""),
        },
        {"role": "user", "content": f"{query}\n\nResponde en espanol, directo y con maximo 6 bullets."},
    ]

    with traced_observation(
        trace_id=trace_id,
        name=f"{AGENT_NAME}.generation",
        input_data={"messages": messages},
        metadata={"agent": AGENT_NAME, "context_found": bool(context)},
    ):
        response = await llm.ainvoke(messages)
    answer = response.content

    logger.info("frontend_agent produced answer")
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
