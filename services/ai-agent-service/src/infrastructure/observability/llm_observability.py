import logging
import re
from contextlib import contextmanager
from typing import Any, Iterator

from ...config import settings

logger = logging.getLogger(__name__)

_client: Any | None = None
_client_failed = False

_EMAIL_RE = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
_JWT_RE = re.compile(r"\beyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\b")


def _enabled() -> bool:
    return bool(
        settings.langfuse_enabled
        and settings.langfuse_public_key
        and settings.langfuse_secret_key
        and not _client_failed
    )


def _get_client() -> Any | None:
    global _client, _client_failed
    if not _enabled():
        return None
    if _client is not None:
        return _client

    try:
        from langfuse import Langfuse

        _client = Langfuse(
            public_key=settings.langfuse_public_key,
            secret_key=settings.langfuse_secret_key,
            host=settings.langfuse_host,
        )
        return _client
    except Exception as exc:
        _client_failed = True
        logger.warning("Langfuse disabled after initialization failure: %s", exc)
        return None


def _safe_payload(value: Any) -> Any:
    if not settings.llm_trace_prompts:
        return "[disabled]"
    if not settings.llm_redact_pii:
        return value
    if isinstance(value, str):
        value = _EMAIL_RE.sub("[redacted-email]", value)
        return _JWT_RE.sub("[redacted-token]", value)
    if isinstance(value, dict):
        return {key: _safe_payload(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_safe_payload(item) for item in value]
    return value


def start_trace(
    *,
    trace_id: str,
    name: str,
    user_id: str,
    session_id: str,
    input_data: Any,
    metadata: dict[str, Any],
) -> None:
    client = _get_client()
    if client is None:
        return
    try:
        client.trace(
            id=trace_id,
            name=name,
            user_id=user_id,
            session_id=session_id,
            input=_safe_payload(input_data),
            metadata=metadata,
        )
    except Exception as exc:
        logger.warning("Langfuse start_trace failed: %s", exc)


def update_trace(
    *,
    trace_id: str,
    output: Any | None = None,
    metadata: dict[str, Any] | None = None,
    tags: list[str] | None = None,
) -> None:
    client = _get_client()
    if client is None:
        return
    try:
        trace = client.trace(id=trace_id)
        trace.update(
            output=_safe_payload(output),
            metadata=metadata,
            tags=tags,
        )
    except Exception as exc:
        logger.warning("Langfuse update_trace failed: %s", exc)


def finish_trace() -> None:
    client = _get_client()
    if client is None:
        return
    try:
        client.flush()
    except Exception as exc:
        logger.warning("Langfuse flush failed: %s", exc)


@contextmanager
def traced_observation(
    *,
    trace_id: str | None,
    name: str,
    input_data: Any | None = None,
    metadata: dict[str, Any] | None = None,
) -> Iterator[None]:
    client = _get_client()
    observation = None
    if client is not None and trace_id:
        try:
            trace = client.trace(id=trace_id)
            observation = trace.span(
                name=name,
                input=_safe_payload(input_data),
                metadata=metadata or {},
            )
        except Exception as exc:
            logger.warning("Langfuse span start failed for %s: %s", name, exc)

    try:
        yield
    except Exception as exc:
        if observation is not None:
            try:
                observation.end(
                    output={"error": str(exc)},
                    level="ERROR",
                    status_message=str(exc),
                )
            except Exception:
                pass
        raise
    else:
        if observation is not None:
            try:
                observation.end()
            except Exception as exc:
                logger.warning("Langfuse span end failed for %s: %s", name, exc)
