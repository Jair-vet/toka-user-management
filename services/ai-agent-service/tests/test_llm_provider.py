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
        assert llm.model_name == "qwen2.5-coder:7b"
        assert "host.docker.internal:11434" in str(llm.openai_api_base)
