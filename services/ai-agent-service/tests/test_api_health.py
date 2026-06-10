"""Integration-style tests for FastAPI health endpoint."""
import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, AsyncMock


@pytest.fixture()
def client():
    with (
        patch("src.main.ensure_collection", new_callable=AsyncMock),
    ):
        from src.main import app
        with TestClient(app) as c:
            yield c


def test_health_returns_ok(client: TestClient):
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["service"] == "ai-agent-service"
