import time
from typing import List
from langchain_openai import OpenAIEmbeddings
from ..config import settings


_embedder: OpenAIEmbeddings | None = None


def get_embedder() -> OpenAIEmbeddings:
    global _embedder
    if _embedder is None:
        _embedder = OpenAIEmbeddings(
            model=settings.embedding_model,
            api_key=settings.openai_api_key,
        )
    return _embedder


async def embed_texts(texts: List[str]) -> List[List[float]]:
    """Generate embeddings for a list of texts."""
    embedder = get_embedder()
    return await embedder.aembed_documents(texts)


async def embed_query(text: str) -> List[float]:
    """Generate embedding for a single query."""
    embedder = get_embedder()
    return await embedder.aembed_query(text)
