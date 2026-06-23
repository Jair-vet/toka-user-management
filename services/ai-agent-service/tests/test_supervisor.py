"""Unit tests for the supervisor multi-agent pattern."""
import pytest
from unittest.mock import MagicMock, patch
from langchain_core.messages import HumanMessage


def _make_state(**overrides) -> dict:
    base = {
        "messages": [HumanMessage(content="How does the React auth flow work?")],
        "intent": "",
        "context": [],
        "tool_results": [],
        "final_answer": "",
        "metadata": {},
        "next_agent": "",
        "agent_outputs": {},
        "supervisor_rounds": 0,
        "supervisor_max_rounds": 3,
    }
    return {**base, **overrides}


def test_supervisor_forces_finish_at_max_rounds():
    """When rounds >= max_rounds and outputs exist, supervisor must FINISH."""
    from src.agents.supervisor import supervisor_node

    state = _make_state(
        supervisor_rounds=3,
        supervisor_max_rounds=3,
        agent_outputs={"frontend_agent": "Some frontend answer."},
    )

    result = supervisor_node(state)
    assert result["next_agent"] == "FINISH"
    assert result["final_answer"] != ""


def test_supervisor_returns_single_output_as_final():
    """Single agent output should be returned directly."""
    from src.agents.supervisor import supervisor_node

    state = _make_state(
        supervisor_rounds=3,
        supervisor_max_rounds=3,
        agent_outputs={"rag_agent": "The answer is 42."},
    )

    result = supervisor_node(state)
    assert result["final_answer"] == "The answer is 42."
    assert result["next_agent"] == "FINISH"


def test_supervisor_finishes_immediately_when_agent_output_exists():
    """The graph should not loop after a worker has produced an answer."""
    from src.agents.supervisor import supervisor_node

    state = _make_state(
        supervisor_rounds=1,
        agent_outputs={"admin_assistant": "Estas son mis capacidades."},
    )

    result = supervisor_node(state)
    assert result["next_agent"] == "FINISH"
    assert result["final_answer"] == "Estas son mis capacidades."
    assert result["supervisor_rounds"] == 1


def test_route_supervisor_returns_next_agent():
    from src.agents.supervisor import route_supervisor

    state = _make_state(next_agent="frontend_agent")
    assert route_supervisor(state) == "frontend_agent"


def test_route_supervisor_defaults_finish():
    from src.agents.supervisor import route_supervisor

    state = _make_state(next_agent="")
    assert route_supervisor(state) == "FINISH"


@pytest.mark.asyncio
async def test_supervisor_calls_llm_for_routing():
    """Supervisor should call LLM when rounds < max and outputs needed."""
    from src.agents.supervisor import supervisor_node

    mock_response = MagicMock()
    mock_response.content = '{"next_agent": "rag_agent", "reasoning": "docs question"}'

    with patch("src.agents.supervisor.get_chat_model") as get_chat_model:
        mock_llm = MagicMock()
        mock_llm.invoke = MagicMock(return_value=mock_response)
        get_chat_model.return_value = mock_llm

        state = _make_state(
            messages=[HumanMessage(content="Classify this ambiguous request")],
            supervisor_rounds=0,
            agent_outputs={},
        )
        result = supervisor_node(state)

        assert result["next_agent"] == "rag_agent"
        assert result["supervisor_rounds"] == 1


def test_supervisor_routes_help_without_llm():
    """Common help questions should route without paying LLM latency."""
    from src.agents.supervisor import supervisor_node

    with patch("src.agents.supervisor.get_chat_model") as get_chat_model:
        state = _make_state(messages=[HumanMessage(content="Que puedes hacer dentro de Toka?")])
        result = supervisor_node(state)

        get_chat_model.assert_not_called()
        assert result["next_agent"] == "admin_assistant"
        assert result["supervisor_rounds"] == 1


@pytest.mark.asyncio
async def test_supervisor_routes_finish_without_outputs_to_admin_assistant():
    """A greeting/help request should not finish with empty synthesis."""
    from src.agents.supervisor import supervisor_node

    mock_response = MagicMock()
    mock_response.content = '{"next_agent": "FINISH", "reasoning": "general help request"}'

    with patch("src.agents.supervisor.get_chat_model") as get_chat_model:
        mock_llm = MagicMock()
        mock_llm.invoke = MagicMock(return_value=mock_response)
        get_chat_model.return_value = mock_llm

        state = _make_state(messages=[HumanMessage(content="hola que podemos hacer?")])
        result = supervisor_node(state)

        assert result["next_agent"] == "admin_assistant"
        assert result["final_answer"] == ""


@pytest.mark.asyncio
async def test_run_agent_returns_required_keys():
    """run_agent must always return answer, intent, latency_ms."""
    final_state = {
        "messages": [],
        "final_answer": "Test answer",
        "agent_outputs": {"rag_agent": "Test answer"},
        "metadata": {},
        "supervisor_rounds": 1,
    }

    with (
        patch("src.agents.orchestrator.build_graph") as mock_build,
        patch("src.agents.orchestrator.track_metrics") as mock_track,
        patch("src.agents.orchestrator.is_llm_configured", return_value=True),
    ):
        from unittest.mock import AsyncMock
        mock_graph = MagicMock()
        mock_graph.ainvoke = AsyncMock(return_value=final_state)
        mock_build.return_value = mock_graph
        mock_track.__wrapped__ = AsyncMock()

        # Reset singleton
        import src.agents.orchestrator as orch
        orch._graph = None

        from src.agents.orchestrator import run_agent
        result = await run_agent("What is RAG?", "session-1", "user-1")

        assert "answer" in result
        assert "intent" in result
        assert "latency_ms" in result
        assert result["answer"] == "Test answer"
