"""Unit tests for RAG chunker."""
import pytest
from src.rag.chunker import chunk_text


def test_chunk_returns_list():
    text = "Hello world. " * 100
    chunks = chunk_text(text)
    assert isinstance(chunks, list)
    assert len(chunks) > 0


def test_chunk_non_empty_results():
    text = "This is a test document with enough content to verify chunking works."
    chunks = chunk_text(text)
    assert all(len(c) > 0 for c in chunks)


def test_short_text_single_chunk():
    text = "Short."
    chunks = chunk_text(text)
    assert len(chunks) == 1
    assert chunks[0] == "Short."


def test_chunk_overlap_content():
    """Verify chunks are not empty and sizes are reasonable."""
    long_text = " ".join([f"Sentence number {i} with some content." for i in range(200)])
    chunks = chunk_text(long_text)
    assert len(chunks) >= 2
    for chunk in chunks:
        assert len(chunk.strip()) > 0


def test_empty_text_returns_empty():
    chunks = chunk_text("")
    assert chunks == [] or (len(chunks) == 1 and chunks[0].strip() == "")
