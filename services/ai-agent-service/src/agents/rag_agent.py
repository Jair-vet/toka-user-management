import logging
from langchain_openai import ChatOpenAI
from langchain_core.messages import AIMessage
from .tools.vector_search import vector_search
from ..prompts.system_prompts import RAG_AGENT_PROMPT
from ..config import settings

logger = logging.getLogger(__name__)


async def rag_agent_node(state: dict) -> dict:
    """RAG Agent: retrieves context and generates answer."""
    query = state["messages"][-1].content

    # Retrieve context
    context_result = await vector_search.ainvoke({"query": query})
    context = context_result if isinstance(context_result, str) else str(context_result)

    # Generate answer with context
    llm = ChatOpenAI(
        model=settings.llm_model,
        api_key=settings.openai_api_key,
        max_tokens=settings.max_tokens,
    )

    system_prompt = RAG_AGENT_PROMPT.format(context=context)
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": query},
    ]

    response = await llm.ainvoke(messages)
    answer = response.content

    return {
        **state,
        "messages": state["messages"] + [AIMessage(content=answer)],
        "context": [{"content": context}],
        "final_answer": answer,
    }
