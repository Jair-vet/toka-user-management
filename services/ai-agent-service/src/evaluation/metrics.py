import logging
from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorClient
from ..config import settings

logger = logging.getLogger(__name__)

_mongo_client: AsyncIOMotorClient | None = None


def get_mongo_client() -> AsyncIOMotorClient:
    global _mongo_client
    if _mongo_client is None:
        _mongo_client = AsyncIOMotorClient(settings.mongodb_url)
    return _mongo_client


async def track_metrics(
    user_id: str,
    session_id: str,
    intent: str,
    latency_ms: int,
    metadata: dict,
) -> None:
    """Store AI interaction metrics in MongoDB."""
    try:
        client = get_mongo_client()
        db = client.get_default_database()
        metrics_collection = db["ai_metrics"]
        await metrics_collection.insert_one({
            "userId": user_id,
            "sessionId": session_id,
            "intent": intent,
            "latencyMs": latency_ms,
            "inputTokens": metadata.get("input_tokens", 0),
            "outputTokens": metadata.get("output_tokens", 0),
            "estimatedCostUsd": metadata.get("cost_usd", 0.0),
            "timestamp": datetime.utcnow(),
        })
    except Exception as e:
        logger.warning(f"Failed to track metrics: {e}")


async def get_metrics_summary(user_id: str | None = None) -> dict:
    """Get aggregated metrics summary."""
    try:
        client = get_mongo_client()
        db = client.get_default_database()
        metrics_collection = db["ai_metrics"]

        filter_query = {}
        if user_id:
            filter_query["userId"] = user_id

        pipeline = [
            {"$match": filter_query},
            {
                "$group": {
                    "_id": None,
                    "total_requests": {"$sum": 1},
                    "avg_latency_ms": {"$avg": "$latencyMs"},
                    "total_input_tokens": {"$sum": "$inputTokens"},
                    "total_output_tokens": {"$sum": "$outputTokens"},
                    "total_cost_usd": {"$sum": "$estimatedCostUsd"},
                }
            },
        ]

        results = await metrics_collection.aggregate(pipeline).to_list(1)
        return results[0] if results else {}
    except Exception:
        return {}
