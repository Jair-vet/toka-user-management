import logging
import sys
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .config import settings
from .api.routes import chat, documents
from .evaluation.metrics import ensure_metrics_indexes
from .infrastructure.vector_store.qdrant_adapter import ensure_collection

logging.basicConfig(
    level=settings.log_level,
    format='{"timestamp": "%(asctime)s", "level": "%(levelname)s", "service": "ai-agent-service", "message": "%(message)s"}',
    stream=sys.stdout,
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Starting AI Agent Service")
    try:
        await ensure_collection()
        logger.info("Qdrant collection initialized")
    except Exception as e:
        logger.warning(f"Could not initialize Qdrant collection: {e}")
    await ensure_metrics_indexes()
    yield
    # Shutdown
    logger.info("Shutting down AI Agent Service")


app = FastAPI(
    title="Toka AI Agent Service",
    description="LangGraph AI orchestrator with RAG pipeline",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat.router)
app.include_router(documents.router)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "ai-agent-service"}
