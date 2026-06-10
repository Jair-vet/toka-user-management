"""Unit tests for RAG pipeline."""
import pytest
from unittest.mock import AsyncMock, patch


@pytest.mark.asyncio
async def test_ingest_document_calls_embed_and_upsert():
    with (
        patch("src.rag.pipeline.chunk_text", return_value=["chunk1", "chunk2"]),
        patch("src.rag.pipeline.ensure_collection", new_callable=AsyncMock),
        patch("src.rag.pipeline.embed_texts", new_callable=AsyncMock) as mock_embed,
        patch("src.rag.pipeline.upsert_vectors", new_callable=AsyncMock) as mock_upsert,
    ):
        mock_embed.return_value = [[0.1] * 1536, [0.2] * 1536]
        mock_upsert.return_value = None

        from src.rag.pipeline import ingest_document

        count = await ingest_document("Test content", "document", "doc-1")

        assert count == 2
        mock_embed.assert_called_once()
        mock_upsert.assert_called_once()


@pytest.mark.asyncio
async def test_retrieve_context_returns_vector_payloads():
    mock_results = [
        {"content": "relevant fact 1", "score": 0.91},
        {"content": "relevant fact 2", "score": 0.82},
    ]
    with (
        patch("src.rag.pipeline.embed_query", new_callable=AsyncMock) as mock_embed_q,
        patch("src.rag.pipeline.search", new_callable=AsyncMock) as mock_search,
    ):
        mock_embed_q.return_value = [0.1] * 1536
        mock_search.return_value = mock_results

        from src.rag.pipeline import retrieve_context

        results = await retrieve_context("What is X?")
        assert isinstance(results, list)
        assert len(results) == 2
        assert results[0]["content"] == "relevant fact 1"
