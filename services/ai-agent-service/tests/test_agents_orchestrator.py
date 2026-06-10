"""Unit tests for LangGraph agent orchestrator."""
import pytest
from unittest.mock import AsyncMock, patch, MagicMock


@pytest.mark.asyncio
async def test_run_agent_returns_required_keys():
    mock_result = {
        "answer": "Here is the answer.",
        "intent": "rag_query",
        "latency_ms": 123,
    }
    with patch("src.agents.orchestrator.build_graph") as mock_build:
        mock_graph = MagicMock()
        mock_graph.ainvoke = AsyncMock(return_value={
            "messages": [],
            "answer": mock_result["answer"],
            "intent": mock_result["intent"],
            "latency_ms": mock_result["latency_ms"],
        })
        mock_build.return_value = mock_graph

        from src.agents.orchestrator import run_agent

        result = await run_agent("What is RAG?", "session-1", "user-1")
        assert "answer" in result
        assert "intent" in result
        assert "latency_ms" in result


@pytest.mark.asyncio
async def test_classify_intent_rag():
    """Intent classification returns known categories."""
    from src.agents.orchestrator import classify_intent

    state = {
        "messages": [],
        "question": "How does RAG work?",
        "answer": "",
        "intent": "",
        "latency_ms": 0,
        "session_id": "s1",
        "user_id": "u1",
    }

    with patch("src.agents.orchestrator.ChatOpenAI") as mock_llm_cls:
        mock_llm = MagicMock()
        mock_llm.invoke = MagicMock(return_value=MagicMock(content="rag_query"))
        mock_llm_cls.return_value = mock_llm

        result = classify_intent(state)
        assert "intent" in result
