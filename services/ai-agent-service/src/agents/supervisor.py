"""
Supervisor Agent — LangChain multi-agent supervisor pattern.

Topology:
  supervisor ──→ frontend_agent ──┐
               ──→ backend_agent  ──┤──→ supervisor ──→ END
               ──→ database_agent ──┤
               ──→ rag_agent      ──┤
               ──→ report_agent   ──┘

The supervisor:
1. Reads the user query + accumulated agent_outputs
2. Decides which agent to invoke next (or FINISH)
3. After FINISH, synthesizes a final answer from all agent outputs
"""
import json
import logging
import re
import unicodedata
from ..prompts.system_prompts import SUPERVISOR_PROMPT
from ..config import settings
from ..infrastructure.llm.provider import get_chat_model
from ..infrastructure.observability import traced_observation
from .trace_state import append_error

logger = logging.getLogger(__name__)

VALID_AGENTS = {
    "frontend_agent",
    "backend_agent",
    "database_agent",
    "rag_agent",
    "report_agent",
    "admin_assistant",
    "FINISH",
}


def supervisor_node(state: dict) -> dict:
    """
    Supervisor decision node.
    Returns updated state with `next_agent` set to the next worker
    or 'FINISH' when synthesis is complete.
    """
    query = state["messages"][0].content  # original user question
    agent_outputs: dict = state.get("agent_outputs", {})
    rounds: int = state.get("supervisor_rounds", 0)
    max_rounds: int = state.get("supervisor_max_rounds", settings.supervisor_max_rounds)
    trace_id: str | None = state.get("trace_id")

    if agent_outputs:
        synthesis = _synthesize(query, agent_outputs)
        logger.info("Supervisor: agent output exists, finishing")
        return {
            **state,
            "next_agent": "FINISH",
            "final_answer": synthesis,
            "supervisor_rounds": rounds,
            "routing_decisions": [
                *state.get("routing_decisions", []),
                {
                    "round": rounds,
                    "next_agent": "FINISH",
                    "reasoning": "agent_output_available",
                },
            ],
        }

    deterministic_agent = _route_without_llm(query)
    if deterministic_agent:
        logger.info("Supervisor deterministic route: next=%s", deterministic_agent)
        return {
            **state,
            "next_agent": deterministic_agent,
            "final_answer": "",
            "supervisor_rounds": rounds + 1,
            "routing_decisions": [
                *state.get("routing_decisions", []),
                {
                    "round": rounds + 1,
                    "next_agent": deterministic_agent,
                    "reasoning": "deterministic_intent_rule",
                },
            ],
        }

    # If max rounds hit, force finish
    if rounds >= max_rounds and agent_outputs:
        synthesis = _synthesize(query, agent_outputs)
        logger.info(f"Supervisor: max rounds reached ({rounds}), finishing")
        return {
            **state,
            "next_agent": "FINISH",
            "final_answer": synthesis,
            "supervisor_rounds": rounds,
            "routing_decisions": [
                *state.get("routing_decisions", []),
                {
                    "round": rounds,
                    "next_agent": "FINISH",
                    "reasoning": "max_rounds_reached",
                },
            ],
        }

    llm = get_chat_model(max_tokens=200, temperature=0)

    already_called = list(agent_outputs.keys())
    context_summary = "\n".join(
        [f"[{k}]: {v[:300]}..." if len(v) > 300 else f"[{k}]: {v}"
         for k, v in agent_outputs.items()]
    ) if agent_outputs else "No agents called yet."

    prompt = f"""{SUPERVISOR_PROMPT}

User query: {query}

Agents already called: {already_called}
Their outputs so far:
{context_summary}

Decide the next step. Respond ONLY with valid JSON, no markdown:
{{"next_agent": "<agent_name or FINISH>", "reasoning": "<brief reason>"}}"""

    try:
        with traced_observation(
            trace_id=trace_id,
            name="supervisor.routing",
            input_data={"query": query, "round": rounds + 1, "agent_outputs": list(agent_outputs.keys())},
            metadata={"round": rounds + 1},
        ):
            response = llm.invoke([{"role": "user", "content": prompt}])
        raw = response.content.strip()
        # Strip markdown fences if present
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[1].rsplit("```", 1)[0].strip()
        decision = json.loads(raw)
        next_agent = decision.get("next_agent", "FINISH")
        reasoning = decision.get("reasoning", "")
    except Exception as e:
        error_message = str(e)
        logger.error(f"Supervisor routing error: {error_message}")
        next_agent = "FINISH"
        reasoning = "provider error"
        error_type = _classify_provider_error(error_message)

        if "insufficient_quota" in error_message or "429" in error_message:
            return {
                **state,
                "next_agent": "FINISH",
                "final_answer": (
                    "The AI provider rejected the request because the configured OpenAI API key "
                    "has no available quota or billing is not active. Add credits or configure a "
                    "different valid OPENAI_API_KEY, then restart the AI service."
                ),
                "metadata": {
                    **state.get("metadata", {}),
                    "ai_error": "openai_insufficient_quota",
                    "error_type": error_type,
                },
                "errors": append_error(
                    state,
                    agent_name="supervisor",
                    error_type=error_type,
                    message=error_message,
                ),
                "supervisor_rounds": rounds + 1,
            }

        if settings.ai_provider.lower() == "ollama":
            return {
                **state,
                "next_agent": "FINISH",
                "final_answer": (
                    "Ollama is selected as the AI provider, but the AI service could not reach "
                    "the local Ollama server or model. Make sure Ollama is installed, running, "
                    f"and that the model '{settings.llm_model}' has been pulled."
                ),
                "metadata": {
                    **state.get("metadata", {}),
                    "ai_error": "ollama_unavailable",
                    "error_type": error_type,
                },
                "errors": append_error(
                    state,
                    agent_name="supervisor",
                    error_type=error_type,
                    message=error_message,
                ),
                "supervisor_rounds": rounds + 1,
            }

    if next_agent not in VALID_AGENTS:
        next_agent = "FINISH"

    # A local model may occasionally choose FINISH for greetings/help requests
    # before any worker has produced an answer. Route those to the read-only
    # admin assistant so the chat returns useful capabilities instead of an
    # empty synthesis.
    if next_agent == "FINISH" and not agent_outputs:
        next_agent = "admin_assistant"
        reasoning = (
            reasoning
            or "No agent output exists yet; route general/help request to admin assistant."
        )

    logger.info(f"Supervisor round {rounds+1}: next={next_agent} | {reasoning}")

    final_answer = ""
    if next_agent == "FINISH":
        final_answer = _synthesize(query, agent_outputs)

    return {
        **state,
        "next_agent": next_agent,
        "final_answer": final_answer,
        "supervisor_rounds": rounds + 1,
        "routing_decisions": [
            *state.get("routing_decisions", []),
            {
                "round": rounds + 1,
                "next_agent": next_agent,
                "reasoning": reasoning,
            },
        ],
    }


def route_supervisor(state: dict) -> str:
    """Conditional edge function for the supervisor node."""
    return state.get("next_agent") or "FINISH"


def _synthesize(query: str, agent_outputs: dict) -> str:
    """Synthesize a final answer from all agent outputs."""
    if not agent_outputs:
        return "I was unable to find information to answer your question."

    if len(agent_outputs) == 1:
        return next(iter(agent_outputs.values()))

    llm = get_chat_model()

    sections = "\n\n".join(
        [f"### {name.replace('_', ' ').title()}\n{output}"
         for name, output in agent_outputs.items()]
    )

    synthesis_prompt = f"""You are synthesizing answers from multiple specialist agents.

Original question: {query}

Agent outputs:
{sections}

Provide a single, coherent, comprehensive answer that:
1. Combines insights from all agents
2. Eliminates redundancy
3. Is clearly structured
4. Directly answers the original question"""

    try:
        response = llm.invoke([{"role": "user", "content": synthesis_prompt}])
        return response.content
    except Exception as e:
        logger.error(f"Synthesis error: {e}")
        return "\n\n".join(agent_outputs.values())


def _classify_provider_error(error_message: str) -> str:
    lowered = error_message.lower()
    if "insufficient_quota" in lowered or "quota" in lowered:
        return "quota"
    if "429" in lowered or "rate limit" in lowered or "ratelimit" in lowered:
        return "rate_limit"
    if "timeout" in lowered or "timed out" in lowered:
        return "timeout"
    if "connection" in lowered or "connect" in lowered or "unavailable" in lowered:
        return "provider_unavailable"
    return "provider_error"


def _route_without_llm(query: str) -> str | None:
    normalized = _normalize(query)

    help_patterns = (
        "hola",
        "hello",
        "ayuda",
        "help",
        "que puedes hacer",
        "que puedo hacer",
        "como me ayudas",
        "que herramientas",
    )
    if any(pattern in normalized for pattern in help_patterns):
        return "admin_assistant"

    report_patterns = (
        "reporte",
        "report",
        "resumen",
        "dashboard",
        "metricas",
        "auditoria",
        "eventos",
        "actividad",
    )
    if any(pattern in normalized for pattern in report_patterns):
        return "report_agent"

    database_patterns = (
        "base de datos",
        "database",
        "postgres",
        "mongodb",
        "redis",
        "qdrant",
        "tabla",
        "schema",
        "usuarios hay",
        "cuantos usuarios",
    )
    if any(pattern in normalized for pattern in database_patterns):
        return "database_agent"

    frontend_patterns = (
        "frontend",
        "react",
        "pantalla",
        "interfaz",
        "ui",
        "vite",
        "zustand",
    )
    if any(pattern in normalized for pattern in frontend_patterns):
        return "frontend_agent"

    backend_patterns = (
        "backend",
        "nestjs",
        "api",
        "endpoint",
        "auth",
        "autenticacion",
        "roles",
        "permisos",
        "keycloak",
    )
    if any(pattern in normalized for pattern in backend_patterns):
        return "backend_agent"

    rag_patterns = (
        "documento",
        "documentacion",
        "manual",
        "politica",
        "arquitectura",
        "sistema",
    )
    if any(pattern in normalized for pattern in rag_patterns):
        return "rag_agent"

    return None


def _normalize(value: str) -> str:
    without_accents = "".join(
        character
        for character in unicodedata.normalize("NFD", value.lower())
        if unicodedata.category(character) != "Mn"
    )
    return re.sub(r"\s+", " ", without_accents).strip()
