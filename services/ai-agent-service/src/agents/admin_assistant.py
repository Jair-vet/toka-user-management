import logging
from langchain_core.messages import AIMessage, HumanMessage
from langgraph.prebuilt import create_react_agent
from .tools.user_lookup import user_lookup
from .tools.audit_search import audit_search
from .tools.vector_search import vector_search
from ..prompts.system_prompts import ADMIN_ASSISTANT_PROMPT
from ..infrastructure.llm.provider import get_chat_model

logger = logging.getLogger(__name__)

TOOLS = [user_lookup, audit_search, vector_search]


async def admin_assistant_node(state: dict) -> dict:
    """Admin Assistant: uses all tools to answer administrative queries."""
    query = state["messages"][-1].content

    llm = get_chat_model()
    agent = create_react_agent(llm, TOOLS, prompt=ADMIN_ASSISTANT_PROMPT)

    try:
        result = await agent.ainvoke({"messages": [HumanMessage(content=query)]})
        answer = result["messages"][-1].content
    except Exception as e:
        logger.error(f"Admin assistant error: {e}")
        answer = f"No pude procesar tu consulta: {str(e)}"

    return {
        **state,
        "messages": state["messages"] + [AIMessage(content=answer)],
        "agent_outputs": {
            **state.get("agent_outputs", {}),
            "admin_assistant": answer,
        },
        "final_answer": answer,
    }
