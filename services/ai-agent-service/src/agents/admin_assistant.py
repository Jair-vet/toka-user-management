import logging
import re
import unicodedata
from langchain_core.messages import AIMessage
from .tools.user_lookup import user_lookup
from .tools.audit_search import audit_search
from .tools.vector_search import vector_search
from ..prompts.system_prompts import ADMIN_ASSISTANT_PROMPT
from ..infrastructure.llm.provider import get_chat_model
from ..infrastructure.observability import traced_observation
from .trace_state import append_agent_path, append_error, append_tool_call

logger = logging.getLogger(__name__)

AGENT_NAME = "admin_assistant"


async def admin_assistant_node(state: dict) -> dict:
    """Admin assistant with bounded tool use and no ReAct recursion."""
    query = state["messages"][-1].content
    trace_id = state.get("trace_id")
    normalized_query = _normalize(query)
    errors = state.get("errors", [])
    tool_calls = state.get("tool_calls", [])

    try:
        if _is_capability_question(normalized_query):
            answer = _capabilities_answer()
        else:
            tool_context: list[str] = []

            if _needs_user_lookup(normalized_query):
                with traced_observation(
                    trace_id=trace_id,
                    name=f"{AGENT_NAME}.user_lookup",
                    input_data={"query": query},
                    metadata={"agent": AGENT_NAME, "tool": "user_lookup"},
                ):
                    user_data = await user_lookup.ainvoke({"query": query})
                tool_context.append(f"[Usuarios]\n{user_data}")
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
                tool_context.append(f"[Auditoria]\n{audit_data}")
                tool_calls = append_tool_call(
                    {"tool_calls": tool_calls},
                    agent_name=AGENT_NAME,
                    tool_name="audit_search",
                    ok=True,
                )

            if _needs_document_lookup(normalized_query):
                with traced_observation(
                    trace_id=trace_id,
                    name=f"{AGENT_NAME}.vector_search",
                    input_data={"query": query},
                    metadata={"agent": AGENT_NAME, "tool": "vector_search"},
                ):
                    docs = await vector_search.ainvoke({"query": query})
                tool_context.append(f"[Documentacion]\n{docs}")
                tool_calls = append_tool_call(
                    {"tool_calls": tool_calls},
                    agent_name=AGENT_NAME,
                    tool_name="vector_search",
                    ok=True,
                )

            answer = await _answer_once(query, "\n\n".join(tool_context), trace_id)
    except Exception as e:
        logger.error("Admin assistant error: %s", e)
        answer = f"No pude procesar tu consulta: {str(e)}"
        errors = append_error(
            state,
            agent_name=AGENT_NAME,
            error_type="agent_error",
            message=str(e),
        )

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


async def _answer_once(query: str, tool_context: str, trace_id: str | None) -> str:
    if not tool_context:
        return (
            "Puedo ayudarte dentro de Toka con usuarios, roles, auditoria, reportes, "
            "documentacion del sistema y explicaciones tecnicas. Prueba con: "
            "'cuantos usuarios hay', 'dame un reporte de auditoria', "
            "'explica la arquitectura' o 'como funciona autenticacion'."
        )

    llm = get_chat_model(max_tokens=280, temperature=0)
    messages = [
        {
            "role": "system",
            "content": (
                f"{ADMIN_ASSISTANT_PROMPT}\n\n"
                "Responde en espanol, directo y breve, con maximo 6 bullets. Usa solo el contexto dado "
                "cuando incluya datos vivos."
            ),
        },
        {
            "role": "user",
            "content": f"Pregunta: {query}\n\nContexto disponible:\n{tool_context}",
        },
    ]

    with traced_observation(
        trace_id=trace_id,
        name=f"{AGENT_NAME}.single_generation",
        input_data={"messages": messages},
        metadata={"agent": AGENT_NAME, "mode": "single_generation"},
    ):
        response = await llm.ainvoke(messages)
    return response.content


def _capabilities_answer() -> str:
    return (
        "Dentro de Toka puedo ayudarte con lo principal del sistema:\n\n"
        "- Usuarios: buscar usuarios, contar registros y revisar estados.\n"
        "- Roles y permisos: explicar la estructura RBAC y el flujo de asignacion.\n"
        "- Auditoria: consultar eventos recientes y resumir actividad.\n"
        "- Reportes: generar resumenes operativos con datos disponibles.\n"
        "- Documentacion/RAG: responder sobre documentos cargados en Qdrant.\n"
        "- Arquitectura: explicar frontend, backend, auth, bases de datos, LiteLLM, Ollama y Langfuse.\n\n"
        "Ejemplos: 'cuantos usuarios hay', 'dame un reporte de auditoria', "
        "'explica el flujo de autenticacion', 'que roles existen' o "
        "'como escala la capa de IA'."
    )


def _is_capability_question(query: str) -> bool:
    patterns = (
        "hola",
        "hello",
        "ayuda",
        "help",
        "que puedes hacer",
        "que puedo hacer",
        "como me ayudas",
        "herramientas",
    )
    return any(pattern in query for pattern in patterns)


def _needs_user_lookup(query: str) -> bool:
    return any(pattern in query for pattern in ("usuario", "usuarios", "user", "users"))


def _needs_audit_lookup(query: str) -> bool:
    return any(
        pattern in query
        for pattern in ("auditoria", "audit", "evento", "eventos", "actividad")
    )


def _needs_document_lookup(query: str) -> bool:
    return any(
        pattern in query
        for pattern in (
            "documento",
            "documentacion",
            "arquitectura",
            "sistema",
            "manual",
            "politica",
        )
    )


def _normalize(value: str) -> str:
    without_accents = "".join(
        character
        for character in unicodedata.normalize("NFD", value.lower())
        if unicodedata.category(character) != "Mn"
    )
    return re.sub(r"\s+", " ", without_accents).strip()
