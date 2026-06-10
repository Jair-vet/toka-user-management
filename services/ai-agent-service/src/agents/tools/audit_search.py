import httpx
from langchain_core.tools import tool
from ...config import settings
from ..auth_context import auth_headers


@tool
async def audit_search(query: str) -> str:
    """
    Search audit logs for recent events.
    Query format: 'action=user.created limit=10' or 'actor=user-uuid' or 'resource=User'
    """
    try:
        params: dict = {"limit": 10}
        if "action=" in query:
            params["action"] = query.split("action=")[1].split()[0]
        if "actor=" in query:
            params["actor"] = query.split("actor=")[1].split()[0]
        if "resource=" in query:
            params["resource"] = query.split("resource=")[1].split()[0]

        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                f"{settings.audit_service_url}/audit/events",
                params=params,
                headers=auth_headers(),
            )
            resp.raise_for_status()
            data = resp.json()
            events = data.get("data", [])
            if not events:
                return "No audit events found."
            result = "\n".join([
                f"- [{e['timestamp']}] {e['action']} by {e.get('actorEmail', e['actor'])} on {e['resource']}"
                for e in events[:10]
            ])
            return f"Recent audit events:\n{result}"
    except Exception as e:
        return f"Error querying audit service: {str(e)}"
