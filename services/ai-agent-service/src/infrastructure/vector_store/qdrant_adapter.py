import uuid
from typing import List, Optional
from qdrant_client import AsyncQdrantClient
from qdrant_client.models import (
    Distance,
    PointStruct,
    VectorParams,
    Filter,
    FieldCondition,
    MatchValue,
    SearchRequest,
)
from ...config import settings


_client: AsyncQdrantClient | None = None


def get_qdrant_client() -> AsyncQdrantClient:
    global _client
    if _client is None:
        _client = AsyncQdrantClient(url=settings.qdrant_url)
    return _client


async def ensure_collection() -> None:
    """Create Qdrant collection if it doesn't exist."""
    client = get_qdrant_client()
    collections = await client.get_collections()
    existing = [c.name for c in collections.collections]
    if settings.qdrant_collection not in existing:
        await client.create_collection(
            collection_name=settings.qdrant_collection,
            vectors_config=VectorParams(size=1536, distance=Distance.COSINE),
        )


async def upsert_vectors(
    vectors: List[List[float]],
    payloads: List[dict],
) -> None:
    """Insert or update vectors in Qdrant."""
    client = get_qdrant_client()
    points = [
        PointStruct(
            id=str(uuid.uuid4()),
            vector=vector,
            payload=payload,
        )
        for vector, payload in zip(vectors, payloads)
    ]
    await client.upsert(collection_name=settings.qdrant_collection, points=points)


async def search(
    query_vector: List[float],
    top_k: int = 5,
    source_type: Optional[str] = None,
) -> List[dict]:
    """Search for similar vectors in Qdrant."""
    client = get_qdrant_client()

    filter_condition = None
    if source_type:
        filter_condition = Filter(
            must=[FieldCondition(key="source_type", match=MatchValue(value=source_type))]
        )

    results = await client.search(
        collection_name=settings.qdrant_collection,
        query_vector=query_vector,
        limit=top_k,
        query_filter=filter_condition,
        with_payload=True,
    )

    return [
        {
            "score": r.score,
            "content": r.payload.get("content", ""),
            "source_type": r.payload.get("source_type", ""),
            "source_id": r.payload.get("source_id", ""),
            "chunk_index": r.payload.get("chunk_index", 0),
        }
        for r in results
    ]
