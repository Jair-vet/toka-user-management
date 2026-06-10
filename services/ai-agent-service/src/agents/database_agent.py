"""Database Specialist Agent — PostgreSQL, MongoDB, Redis, Qdrant."""
import logging
from langchain_openai import ChatOpenAI
from langchain_core.messages import AIMessage
from .tools.user_lookup import user_lookup
from .tools.audit_search import audit_search
from ..prompts.system_prompts import DATABASE_AGENT_PROMPT
from ..config import settings

logger = logging.getLogger(__name__)

TOOLS = [user_lookup, audit_search]


async def database_agent_node(state: dict) -> dict:
    """Database agent: answers schema, query, and data model questions."""
    query = state["messages"][-1].content

    # Fetch live data samples to ground answers
    tool_results = []
    try:
        user_data = await user_lookup.ainvoke({"query": "count"})
        tool_results.append(f"Current user count: {user_data}")
    except Exception as e:
        logger.warning(f"user_lookup failed in database_agent: {e}")

    context = "\n".join(tool_results) if tool_results else ""

    llm = ChatOpenAI(
        model=settings.llm_model,
        api_key=settings.openai_api_key,
        max_tokens=settings.max_tokens,
    )

    messages = [
        {
            "role": "system",
            "content": DATABASE_AGENT_PROMPT
            + (f"\n\nLive data:\n{context}" if context else ""),
        },
        {"role": "user", "content": query},
    ]

    response = await llm.ainvoke(messages)
    answer = response.content

    logger.info("database_agent produced answer")
    return {
        **state,
        "messages": state["messages"] + [AIMessage(content=answer)],
        "agent_outputs": {
            **state.get("agent_outputs", {}),
            "database_agent": answer,
        },
        "final_answer": answer,
    }
