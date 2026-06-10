import httpx
from fastapi import HTTPException, Security
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from ...config import settings

security = HTTPBearer(auto_error=False)

_jwks_cache: dict | None = None


async def get_jwks() -> dict:
    global _jwks_cache
    if _jwks_cache:
        return _jwks_cache
    url = f"{settings.keycloak_url}/realms/{settings.keycloak_realm}/protocol/openid-connect/certs"
    async with httpx.AsyncClient() as client:
        resp = await client.get(url)
        _jwks_cache = resp.json()
    return _jwks_cache


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Security(security),
) -> dict:
    if not credentials:
        raise HTTPException(status_code=401, detail="Missing authorization token")

    token = credentials.credentials
    try:
        jwks = await get_jwks()
        # Decode without verification first to get kid
        header = jwt.get_unverified_header(token)
        kid = header.get("kid")

        # Find matching key
        key = next((k for k in jwks.get("keys", []) if k.get("kid") == kid), None)
        if not key:
            raise HTTPException(status_code=401, detail="Invalid token key")

        payload = jwt.decode(
            token,
            key,
            algorithms=["RS256"],
            options={"verify_aud": False},
        )
        expected_issuer = f"{settings.keycloak_url}/realms/{settings.keycloak_realm}"
        if payload.get("iss") != expected_issuer:
            raise HTTPException(status_code=401, detail="Invalid token issuer")

        allowed_clients = {
            client.strip()
            for client in settings.keycloak_allowed_clients.split(",")
            if client.strip()
        }
        audiences = payload.get("aud", [])
        if isinstance(audiences, str):
            audiences = [audiences]
        authorized_party = payload.get("azp")
        if authorized_party not in allowed_clients and not any(aud in allowed_clients for aud in audiences):
            raise HTTPException(status_code=401, detail="Invalid token client")

        payload["__access_token"] = token
        return payload
    except JWTError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")
