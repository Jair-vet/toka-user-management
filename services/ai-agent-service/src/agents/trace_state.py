from typing import Any


def append_agent_path(state: dict[str, Any], agent_name: str) -> list[str]:
    return [*state.get("agent_path", []), agent_name]


def append_tool_call(
    state: dict[str, Any],
    *,
    agent_name: str,
    tool_name: str,
    ok: bool,
    error: str | None = None,
) -> list[dict[str, Any]]:
    return [
        *state.get("tool_calls", []),
        {
            "agent": agent_name,
            "tool": tool_name,
            "ok": ok,
            **({"error": error} if error else {}),
        },
    ]


def append_error(
    state: dict[str, Any],
    *,
    agent_name: str,
    error_type: str,
    message: str,
) -> list[dict[str, str]]:
    return [
        *state.get("errors", []),
        {
            "agent": agent_name,
            "type": error_type,
            "message": message,
        },
    ]
