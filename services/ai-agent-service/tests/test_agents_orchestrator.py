"""Unit tests for the current LangGraph supervisor orchestrator."""
from unittest.mock import AsyncMock, MagicMock, patch

import pytest


@pytest.mark.asyncio
async def test_run_agent_returns_degraded_mode_when_llm_provider_missing():
    with (
        patch("src.agents.orchestrator.is_llm_configured", return_value=False),
        patch("src.agents.orchestrator.track_metrics", new=AsyncMock()) as track_metrics,
    ):
        from src.agents.orchestrator import run_agent

        result = await run_agent("What is RAG?", "session-1", "user-1", "token-1")

        assert result["intent"] == "degraded_no_llm_provider"
        assert "LLM provider" in result["answer"]
        track_metrics.assert_awaited_once()


@pytest.mark.asyncio
async def test_run_agent_sets_access_token_context_for_tools():
    final_state = {
        "messages": [],
        "final_answer": "Token-aware answer",
        "agent_outputs": {"backend_agent": "Token-aware answer"},
        "metadata": {},
    }

    with (
        patch("src.agents.orchestrator.is_llm_configured", return_value=True),
        patch("src.agents.orchestrator.build_graph") as build_graph,
        patch("src.agents.orchestrator.track_metrics", new=AsyncMock()),
    ):
        from src.agents.auth_context import auth_headers

        async def invoke_with_context(_state: dict) -> dict:
            assert auth_headers() == {"Authorization": "Bearer user-token"}
            return final_state

        graph = MagicMock()
        graph.ainvoke = AsyncMock(side_effect=invoke_with_context)
        build_graph.return_value = graph

        import src.agents.orchestrator as orchestrator
        orchestrator._graph = None

        result = await orchestrator.run_agent(
            "List users",
            "session-1",
            "user-1",
            "user-token",
        )

        assert result["answer"] == "Token-aware answer"
        assert result["intent"] == "backend_agent"
        assert auth_headers() == {}
