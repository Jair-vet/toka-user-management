import asyncio
import json
import uuid
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from ...agents.orchestrator import run_agent
from ...api.middleware.jwt_validation import get_current_user

router = APIRouter(prefix="/ai", tags=["AI Chat"])


class ChatRequest(BaseModel):
    message: str
    session_id: str | None = None


class ChatResponse(BaseModel):
    answer: str
    session_id: str
    intent: str
    latency_ms: int


@router.post("/chat", response_model=ChatResponse)
async def chat(
    request: ChatRequest,
    current_user: dict = Depends(get_current_user),
):
    """Chat with the AI assistant."""
    session_id = request.session_id or str(uuid.uuid4())
    user_id = current_user.get("sub", "anonymous")

    try:
        result = await run_agent(
            request.message,
            session_id,
            user_id,
            current_user.get("__access_token"),
        )
        return ChatResponse(
            answer=result["answer"],
            session_id=session_id,
            intent=result["intent"],
            latency_ms=result["latency_ms"],
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Agent error: {str(e)}")


@router.post("/chat/stream")
async def chat_stream(
    request: ChatRequest,
    current_user: dict = Depends(get_current_user),
):
    """Stream AI assistant responses via SSE."""
    session_id = request.session_id or str(uuid.uuid4())
    user_id = current_user.get("sub", "anonymous")

    async def generate():
        try:
            result = await run_agent(
                request.message,
                session_id,
                user_id,
                current_user.get("__access_token"),
            )
            answer = result["answer"]

            # Simulate streaming word by word
            words = answer.split(" ")
            for word in words:
                data = json.dumps({"token": word + " ", "done": False})
                yield f"data: {data}\n\n"
                await asyncio.sleep(0.05)

            # Final event
            done_data = json.dumps({
                "token": "",
                "done": True,
                "session_id": session_id,
                "intent": result["intent"],
                "latency_ms": result["latency_ms"],
            })
            yield f"data: {done_data}\n\n"
        except Exception as e:
            error_data = json.dumps({"error": str(e), "done": True})
            yield f"data: {error_data}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")
