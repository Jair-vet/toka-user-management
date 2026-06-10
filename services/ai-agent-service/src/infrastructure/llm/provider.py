from langchain_openai import ChatOpenAI, OpenAIEmbeddings

from ...config import settings


def _is_ollama() -> bool:
    return settings.ai_provider.lower() == "ollama"


def is_llm_configured() -> bool:
    if _is_ollama():
        return bool(settings.ollama_base_url)
    return bool(settings.openai_api_key)


def get_chat_model(max_tokens: int | None = None, temperature: float = 0):
    if _is_ollama():
        from langchain_ollama import ChatOllama
        return ChatOllama(
            model=settings.llm_model,
            base_url=settings.ollama_base_url,
            temperature=temperature,
            num_predict=max_tokens or settings.max_tokens,
        )
    return ChatOpenAI(
        model=settings.llm_model,
        api_key=settings.openai_api_key,
        base_url=settings.openai_base_url,
        max_tokens=max_tokens or settings.max_tokens,
        temperature=temperature,
    )


def get_embeddings_model():
    if _is_ollama():
        from langchain_ollama import OllamaEmbeddings
        return OllamaEmbeddings(
            model=settings.ollama_embedding_model,
            base_url=settings.ollama_base_url,
        )
    return OpenAIEmbeddings(
        model=settings.embedding_model,
        api_key=settings.openai_api_key,
        base_url=settings.openai_base_url,
    )
