import logging
from langchain_core.messages import AIMessage
from .tools.user_lookup import user_lookup
from .tools.audit_search import audit_search
from ..prompts.system_prompts import REPORT_AGENT_PROMPT
from ..infrastructure.llm.provider import get_chat_model

logger = logging.getLogger(__name__)


async def report_agent_node(state: dict) -> dict:
    """Report Agent: fetches live data and generates structured reports."""
    query = state["messages"][-1].content

    # Gather data from multiple sources
    tool_results = []

    try:
        user_data = await user_lookup.ainvoke({"query": query})
        tool_results.append({"tool": "user_lookup", "result": user_data})
    except Exception as e:
        logger.warning(f"user_lookup failed: {e}")

    try:
        audit_data = await audit_search.ainvoke({"query": "limit=5"})
        tool_results.append({"tool": "audit_search", "result": audit_data})
    except Exception as e:
        logger.warning(f"audit_search failed: {e}")

    # Format tool results as context
    context = "\n\n".join([f"[{r['tool']}]:\n{r['result']}" for r in tool_results])

    # Generate report with LLM
    llm = get_chat_model()

    messages = [
        {"role": "system", "content": REPORT_AGENT_PROMPT},
        {"role": "user", "content": f"Query: {query}\n\nAvailable data:\n{context}"},
    ]

    response = await llm.ainvoke(messages)
    answer = response.content

    return {
        **state,
        "messages": state["messages"] + [AIMessage(content=answer)],
        "tool_results": tool_results,
        "agent_outputs": {
            **state.get("agent_outputs", {}),
            "report_agent": answer,
        },
        "final_answer": answer,
    }
