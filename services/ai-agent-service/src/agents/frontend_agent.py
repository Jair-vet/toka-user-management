"""Frontend Specialist Agent — React, Zustand, TanStack Query, design system."""
import logging
from langchain_core.messages import AIMessage
from .tools.vector_search import vector_search
from ..prompts.system_prompts import FRONTEND_AGENT_PROMPT
from ..infrastructure.llm.provider import get_chat_model

logger = logging.getLogger(__name__)


async def frontend_agent_node(state: dict) -> dict:
    """Frontend agent: answers React/UI/design-system questions."""
    query = state["messages"][-1].content

    # Search docs for relevant frontend context
    context = ""
    try:
        context = await vector_search.ainvoke({"query": f"frontend React {query}"})
    except Exception as e:
        logger.warning(f"vector_search failed in frontend_agent: {e}")

    llm = get_chat_model()

    messages = [
        {
            "role": "system",
            "content": FRONTEND_AGENT_PROMPT
            + (f"\n\nRelevant docs:\n{context}" if context else ""),
        },
        {"role": "user", "content": query},
    ]

    response = await llm.ainvoke(messages)
    answer = response.content

    logger.info("frontend_agent produced answer")
    return {
        **state,
        "messages": state["messages"] + [AIMessage(content=answer)],
        "agent_outputs": {
            **state.get("agent_outputs", {}),
            "frontend_agent": answer,
        },
        "final_answer": answer,
    }
