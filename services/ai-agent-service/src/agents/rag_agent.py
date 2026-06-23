import logging
from langchain_core.messages import AIMessage
from .tools.vector_search import vector_search
from ..prompts.system_prompts import RAG_AGENT_PROMPT
from ..infrastructure.llm.provider import get_chat_model
from ..infrastructure.observability import traced_observation
from .trace_state import append_agent_path, append_tool_call

logger = logging.getLogger(__name__)
AGENT_NAME = "rag_agent"


async def rag_agent_node(state: dict) -> dict:
    """RAG Agent: retrieves context and generates answer."""
    query = state["messages"][-1].content
    trace_id = state.get("trace_id")

    # Retrieve context
    with traced_observation(
        trace_id=trace_id,
        name=f"{AGENT_NAME}.vector_search",
        input_data={"query": query},
        metadata={"agent": AGENT_NAME, "tool": "vector_search"},
    ):
        context_result = await vector_search.ainvoke({"query": query})
    context = context_result if isinstance(context_result, str) else str(context_result)
    tool_calls = append_tool_call(state, agent_name=AGENT_NAME, tool_name="vector_search", ok=True)

    # Generate answer with context
    llm = get_chat_model(max_tokens=360, temperature=0)

    system_prompt = RAG_AGENT_PROMPT.format(context=context)
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": f"{query}\n\nResponde en espanol, directo y con maximo 6 bullets."},
    ]

    with traced_observation(
        trace_id=trace_id,
        name=f"{AGENT_NAME}.generation",
        input_data={"messages": messages},
        metadata={
            "agent": AGENT_NAME,
            "retrieval_hits": 0 if "No relevant documentation found" in context else 1,
        },
    ):
        response = await llm.ainvoke(messages)
    answer = response.content

    return {
        **state,
        "messages": state["messages"] + [AIMessage(content=answer)],
        "context": [{"content": context}],
        "agent_path": append_agent_path(state, AGENT_NAME),
        "tool_calls": tool_calls,
        "agent_outputs": {
            **state.get("agent_outputs", {}),
            AGENT_NAME: answer,
        },
        "final_answer": answer,
    }
