"""Backend Specialist Agent — NestJS, Clean Architecture, auth, events."""
import logging
from langchain_core.messages import AIMessage, HumanMessage
from langgraph.prebuilt import create_react_agent
from .tools.user_lookup import user_lookup
from .tools.audit_search import audit_search
from .tools.vector_search import vector_search
from ..prompts.system_prompts import BACKEND_AGENT_PROMPT
from ..infrastructure.llm.provider import get_chat_model

logger = logging.getLogger(__name__)

TOOLS = [user_lookup, audit_search, vector_search]


async def backend_agent_node(state: dict) -> dict:
    """Backend agent: answers NestJS/API/auth questions, can call services."""
    query = state["messages"][-1].content

    llm = get_chat_model()
    agent = create_react_agent(llm, TOOLS, prompt=BACKEND_AGENT_PROMPT)

    try:
        result = await agent.ainvoke({"messages": [HumanMessage(content=query)]})
        answer = result["messages"][-1].content
    except Exception as e:
        logger.error(f"backend_agent error: {e}")
        answer = f"Backend specialist encontró un error: {str(e)}"

    logger.info("backend_agent produced answer")
    return {
        **state,
        "messages": state["messages"] + [AIMessage(content=answer)],
        "agent_outputs": {
            **state.get("agent_outputs", {}),
            "backend_agent": answer,
        },
        "final_answer": answer,
    }
