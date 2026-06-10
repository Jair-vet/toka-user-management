import logging
from langchain_openai import ChatOpenAI
from langchain_core.messages import AIMessage
from langchain.agents import AgentExecutor, create_tool_calling_agent
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from .tools.user_lookup import user_lookup
from .tools.audit_search import audit_search
from .tools.vector_search import vector_search
from ..prompts.system_prompts import ADMIN_ASSISTANT_PROMPT
from ..config import settings

logger = logging.getLogger(__name__)

TOOLS = [user_lookup, audit_search, vector_search]


async def admin_assistant_node(state: dict) -> dict:
    """Admin Assistant: uses all tools to answer administrative queries."""
    query = state["messages"][-1].content

    llm = ChatOpenAI(
        model=settings.llm_model,
        api_key=settings.openai_api_key,
        max_tokens=settings.max_tokens,
    )

    prompt = ChatPromptTemplate.from_messages([
        ("system", ADMIN_ASSISTANT_PROMPT),
        MessagesPlaceholder("chat_history", optional=True),
        ("human", "{input}"),
        MessagesPlaceholder("agent_scratchpad"),
    ])

    agent = create_tool_calling_agent(llm, TOOLS, prompt)
    executor = AgentExecutor(agent=agent, tools=TOOLS, verbose=False, max_iterations=5)

    try:
        result = await executor.ainvoke({"input": query})
        answer = result.get("output", "Unable to process your request.")
    except Exception as e:
        logger.error(f"Admin assistant error: {e}")
        answer = f"I encountered an error while processing your request: {str(e)}"

    return {
        **state,
        "messages": state["messages"] + [AIMessage(content=answer)],
        "final_answer": answer,
    }
