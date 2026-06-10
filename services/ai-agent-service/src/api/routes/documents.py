from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from ...rag.pipeline import ingest_document
from ...api.middleware.jwt_validation import get_current_user

router = APIRouter(prefix="/ai", tags=["Documents"])


class IngestRequest(BaseModel):
    content: str
    source_type: str = "document"
    source_id: str = "manual"


class IngestResponse(BaseModel):
    chunks_created: int
    source_type: str
    source_id: str


@router.post("/documents/ingest", response_model=IngestResponse)
async def ingest_documents(
    request: IngestRequest,
    current_user: dict = Depends(get_current_user),
):
    """Ingest a document into the AI knowledge base."""
    try:
        chunks = await ingest_document(request.content, request.source_type, request.source_id)
        return IngestResponse(
            chunks_created=chunks,
            source_type=request.source_type,
            source_id=request.source_id,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ingestion error: {str(e)}")
