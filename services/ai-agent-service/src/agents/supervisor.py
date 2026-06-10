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
from langchain_openai import ChatOpenAI
from langchain_core.messages import AIMessage
from ..prompts.system_prompts import SUPERVISOR_PROMPT
from ..config import settings

logger = logging.getLogger(__name__)

VALID_AGENTS = {
    "frontend_agent",
    "backend_agent",
    "database_agent",
    "rag_agent",
    "report_agent",
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

    # If max rounds hit, force finish
    if rounds >= max_rounds and agent_outputs:
        synthesis = _synthesize(query, agent_outputs)
        logger.info(f"Supervisor: max rounds reached ({rounds}), finishing")
        return {
            **state,
            "next_agent": "FINISH",
            "final_answer": synthesis,
            "supervisor_rounds": rounds,
        }

    llm = ChatOpenAI(
        model="gpt-4o-mini",
        api_key=settings.openai_api_key,
        max_tokens=200,
        temperature=0,
    )

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
        response = llm.invoke([{"role": "user", "content": prompt}])
        raw = response.content.strip()
        # Strip markdown fences if present
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[1].rsplit("```", 1)[0].strip()
        decision = json.loads(raw)
        next_agent = decision.get("next_agent", "FINISH")
        reasoning = decision.get("reasoning", "")
    except Exception as e:
        logger.error(f"Supervisor JSON parse error: {e}")
        next_agent = "FINISH"
        reasoning = "parse error"

    if next_agent not in VALID_AGENTS:
        next_agent = "FINISH"

    logger.info(f"Supervisor round {rounds+1}: next={next_agent} | {reasoning}")

    final_answer = ""
    if next_agent == "FINISH":
        final_answer = _synthesize(query, agent_outputs)

    return {
        **state,
        "next_agent": next_agent,
        "final_answer": final_answer,
        "supervisor_rounds": rounds + 1,
    }


def route_supervisor(state: dict) -> str:
    """Conditional edge function for the supervisor node."""
    return state.get("next_agent", "FINISH")


def _synthesize(query: str, agent_outputs: dict) -> str:
    """Synthesize a final answer from all agent outputs."""
    if not agent_outputs:
        return "I was unable to find information to answer your question."

    if len(agent_outputs) == 1:
        return next(iter(agent_outputs.values()))

    llm = ChatOpenAI(
        model=settings.llm_model,
        api_key=settings.openai_api_key,
        max_tokens=settings.max_tokens,
    )

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
