import logging
from typing import List
from .chunker import chunk_text
from .embedder import embed_texts, embed_query
from ..infrastructure.vector_store.qdrant_adapter import ensure_collection, upsert_vectors, search
from ..config import settings

logger = logging.getLogger(__name__)


async def ingest_document(
    content: str,
    source_type: str,
    source_id: str,
) -> int:
    """
    Full ingestion pipeline: chunk → embed → upsert to Qdrant.
    Returns number of chunks created.
    """
    await ensure_collection()

    chunks = chunk_text(content, settings.chunk_size, settings.chunk_overlap)
    if not chunks:
        return 0

    if not settings.openai_api_key:
        logger.warning(
            "OPENAI_API_KEY is not configured; document chunked but not embedded/upserted"
        )
        return len(chunks)

    vectors = await embed_texts(chunks)

    payloads = [
        {
            "content": chunk,
            "source_type": source_type,
            "source_id": source_id,
            "chunk_index": i,
        }
        for i, chunk in enumerate(chunks)
    ]

    await upsert_vectors(vectors, payloads)
    logger.info(f"Ingested {len(chunks)} chunks for {source_type}/{source_id}")
    return len(chunks)


async def retrieve_context(query: str, top_k: int = 5) -> List[dict]:
    """Retrieve relevant context for a query."""
    if not settings.openai_api_key:
        return []
    query_vector = await embed_query(query)
    results = await search(query_vector, top_k=top_k)
    return results
