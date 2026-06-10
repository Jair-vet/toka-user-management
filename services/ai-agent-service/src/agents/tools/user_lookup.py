import httpx
from langchain_core.tools import tool
from ...config import settings
from ..auth_context import auth_headers


@tool
async def user_lookup(query: str) -> str:
    """
    Search for users in the User Service.
    Use this to get user information, counts, or specific user details.
    Query can be: email, name, or 'status=ACTIVE count' for statistics.
    """
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            if "count" in query.lower() or "how many" in query.lower():
                resp = await client.get(
                    f"{settings.user_service_url}/users?limit=1",
                    headers=auth_headers(),
                )
                resp.raise_for_status()
                data = resp.json()
                total = data.get("meta", {}).get("total", 0)
                return f"Total users: {total}"
            else:
                resp = await client.get(
                    f"{settings.user_service_url}/users",
                    params={"search": query, "limit": 5},
                    headers=auth_headers(),
                )
                resp.raise_for_status()
                data = resp.json()
                users = data.get("data", [])
                if not users:
                    return "No users found matching the query."
                result = "\n".join([
                    f"- {u['firstName']} {u['lastName']} ({u['email']}) — Status: {u['status']}"
                    for u in users
                ])
                return f"Found {len(users)} user(s):\n{result}"
    except Exception as e:
        return f"Error querying user service: {str(e)}"
