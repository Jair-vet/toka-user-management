from unittest.mock import patch


def test_ollama_provider_uses_local_openai_compatible_endpoint():
    from src.infrastructure.llm.provider import get_chat_model, is_llm_configured

    with (
        patch("src.infrastructure.llm.provider.settings.ai_provider", "ollama"),
        patch(
            "src.infrastructure.llm.provider.settings.ollama_base_url",
            "http://host.docker.internal:11434/v1",
        ),
        patch("src.infrastructure.llm.provider.settings.llm_model", "qwen2.5-coder:7b"),
    ):
        llm = get_chat_model(max_tokens=128)

        assert is_llm_configured() is True
        assert llm.model == "qwen2.5-coder:7b"
        assert "host.docker.internal:11434" in str(llm.base_url)


def test_litellm_provider_uses_openai_compatible_gateway():
    from src.infrastructure.llm.provider import get_chat_model, get_llm_metadata, is_llm_configured

    with (
        patch("src.infrastructure.llm.provider.settings.ai_provider", "litellm"),
        patch("src.infrastructure.llm.provider.settings.openai_api_key", "sk-toka-master"),
        patch("src.infrastructure.llm.provider.settings.openai_base_url", "http://litellm:4000/v1"),
        patch("src.infrastructure.llm.provider.settings.llm_model", "toka-chat"),
    ):
        llm = get_chat_model(max_tokens=128)
        metadata = get_llm_metadata()

        assert is_llm_configured() is True
        assert llm.model_name == "toka-chat"
        assert "litellm:4000" in str(llm.openai_api_base)
        assert metadata["provider"] == "litellm"
        assert metadata["model"] == "toka-chat"
