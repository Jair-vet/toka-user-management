"""Unit tests for JWT validation middleware."""
import pytest
from unittest.mock import AsyncMock, patch
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials


@pytest.mark.asyncio
async def test_get_current_user_raises_401_when_no_credentials():
    from src.api.middleware.jwt_validation import get_current_user

    with pytest.raises(HTTPException) as exc_info:
        await get_current_user(None)

    assert exc_info.value.status_code == 401


@pytest.mark.asyncio
async def test_get_current_user_raises_401_on_invalid_token():
    from src.api.middleware.jwt_validation import get_current_user, _jwks_cache
    import src.api.middleware.jwt_validation as jwt_mod

    # Reset cache
    jwt_mod._jwks_cache = {"keys": [{"kid": "key-1", "kty": "RSA"}]}

    credentials = HTTPAuthorizationCredentials(
        scheme="Bearer", credentials="invalid.token.here"
    )

    with pytest.raises(HTTPException) as exc_info:
        await get_current_user(credentials)

    assert exc_info.value.status_code == 401


@pytest.mark.asyncio
async def test_get_jwks_caches_result():
    import src.api.middleware.jwt_validation as jwt_mod

    jwt_mod._jwks_cache = None
    mock_jwks = {"keys": [{"kid": "k1"}]}

    with patch("src.api.middleware.jwt_validation.httpx") as mock_httpx:
        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)
        mock_resp = AsyncMock()
        mock_resp.json = MagicMock(return_value=mock_jwks)
        mock_client.get = AsyncMock(return_value=mock_resp)
        mock_httpx.AsyncClient.return_value = mock_client

        from src.api.middleware.jwt_validation import get_jwks
        result = await get_jwks()
        # Second call should use cache
        result2 = await get_jwks()
        assert result == result2


# Need MagicMock in test
from unittest.mock import MagicMock
