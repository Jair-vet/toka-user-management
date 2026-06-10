from contextvars import ContextVar, Token


_access_token: ContextVar[str | None] = ContextVar("ai_agent_access_token", default=None)


def set_access_token(access_token: str | None) -> Token[str | None]:
    return _access_token.set(access_token)


def reset_access_token(token: Token[str | None]) -> None:
    _access_token.reset(token)


def auth_headers() -> dict[str, str]:
    access_token = _access_token.get()
    if not access_token:
        return {}
    return {"Authorization": f"Bearer {access_token}"}
