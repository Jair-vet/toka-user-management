"""Backend Specialist Agent: NestJS, Clean Architecture, auth, APIs, events."""
import logging
import re
import unicodedata
from langchain_core.messages import AIMessage
from .tools.user_lookup import user_lookup
from .tools.audit_search import audit_search
from .tools.vector_search import vector_search
from ..prompts.system_prompts import BACKEND_AGENT_PROMPT
from ..infrastructure.llm.provider import get_chat_model
from ..infrastructure.observability import traced_observation
from .trace_state import append_agent_path, append_error, append_tool_call

logger = logging.getLogger(__name__)

AGENT_NAME = "backend_agent"


async def backend_agent_node(state: dict) -> dict:
    """Answer backend questions with bounded tool use and one LLM call."""
    query = state["messages"][-1].content
    trace_id = state.get("trace_id")
    normalized_query = _normalize(query)
    errors = state.get("errors", [])
    tool_calls = state.get("tool_calls", [])
    context_parts: list[str] = []

    try:
        if _needs_user_lookup(normalized_query):
            with traced_observation(
                trace_id=trace_id,
                name=f"{AGENT_NAME}.user_lookup",
                input_data={"query": query},
                metadata={"agent": AGENT_NAME, "tool": "user_lookup"},
            ):
                user_data = await user_lookup.ainvoke({"query": query})
            context_parts.append(f"[Usuarios]\n{user_data}")
            tool_calls = append_tool_call(
                {"tool_calls": tool_calls},
                agent_name=AGENT_NAME,
                tool_name="user_lookup",
                ok=True,
            )

        if _needs_audit_lookup(normalized_query):
            with traced_observation(
                trace_id=trace_id,
                name=f"{AGENT_NAME}.audit_search",
                input_data={"query": query},
                metadata={"agent": AGENT_NAME, "tool": "audit_search"},
            ):
                audit_data = await audit_search.ainvoke({"query": query})
            context_parts.append(f"[Auditoria]\n{audit_data}")
            tool_calls = append_tool_call(
                {"tool_calls": tool_calls},
                agent_name=AGENT_NAME,
                tool_name="audit_search",
                ok=True,
            )

        with traced_observation(
            trace_id=trace_id,
            name=f"{AGENT_NAME}.vector_search",
            input_data={"query": query},
            metadata={"agent": AGENT_NAME, "tool": "vector_search"},
        ):
            docs = await vector_search.ainvoke({"query": f"backend auth api {query}"})
        context_parts.append(f"[Documentacion]\n{docs}")
        tool_calls = append_tool_call(
            {"tool_calls": tool_calls},
            agent_name=AGENT_NAME,
            tool_name="vector_search",
            ok=True,
        )

        llm = get_chat_model(max_tokens=280, temperature=0)
        context = "\n\n".join(context_parts)
        messages = [
            {"role": "system", "content": BACKEND_AGENT_PROMPT},
            {
                "role": "user",
                "content": (
                    f"Pregunta: {query}\n\n"
                    f"Contexto disponible:\n{context}\n\n"
                    "Responde en espanol, directo, con maximo 6 bullets."
                ),
            },
        ]
        with traced_observation(
            trace_id=trace_id,
            name=f"{AGENT_NAME}.single_generation",
            input_data={"messages": messages},
            metadata={"agent": AGENT_NAME, "mode": "single_generation"},
        ):
            response = await llm.ainvoke(messages)
        answer = response.content
    except Exception as e:
        logger.error("backend_agent error: %s", e)
        answer = f"Backend specialist encontro un error: {str(e)}"
        errors = append_error(
            state,
            agent_name=AGENT_NAME,
            error_type="agent_error",
            message=str(e),
        )

    logger.info("backend_agent produced answer")
    return {
        **state,
        "messages": state["messages"] + [AIMessage(content=answer)],
        "agent_path": append_agent_path(state, AGENT_NAME),
        "tool_calls": tool_calls,
        "errors": errors,
        "agent_outputs": {
            **state.get("agent_outputs", {}),
            AGENT_NAME: answer,
        },
        "final_answer": answer,
    }


def _needs_user_lookup(query: str) -> bool:
    return any(pattern in query for pattern in ("usuario", "usuarios", "user", "users"))


def _needs_audit_lookup(query: str) -> bool:
    return any(
        pattern in query
        for pattern in ("auditoria", "audit", "evento", "eventos", "actividad")
    )


def _normalize(value: str) -> str:
    without_accents = "".join(
        character
        for character in unicodedata.normalize("NFD", value.lower())
        if unicodedata.category(character) != "Mn"
    )
    return re.sub(r"\s+", " ", without_accents).strip()
