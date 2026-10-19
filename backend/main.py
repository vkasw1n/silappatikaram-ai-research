import asyncio
from dotenv import load_dotenv
import logging
import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

load_dotenv(dotenv_path=Path(__file__).resolve().parents[1] / ".env")

try:
	from .api.corpus import router as corpus_router
	from .api.preprocessing import router as preprocessing_router
	from .api.interpretation import router as interpretation_router
	from .api.propositions import router as propositions_router
	from .api.graph import router as graph_router
	from .api.rag import router as rag_router
	from .api.graph_status import router as graph_status_router
	from .api.evaluation import router as evaluation_router
	from .api.samples import router as samples_router
except ImportError:
	from api.corpus import router as corpus_router
	from api.preprocessing import router as preprocessing_router
	from api.interpretation import router as interpretation_router
	from api.propositions import router as propositions_router
	from api.graph import router as graph_router
	from api.rag import router as rag_router
	from api.graph_status import router as graph_status_router
	from api.evaluation import router as evaluation_router
	from api.samples import router as samples_router

app = FastAPI(title="Silappatikaram Corpus API")
logger = logging.getLogger(__name__)


@app.on_event("startup")
async def load_rag_index() -> None:
	try:
		from .application.rag_service import get_rag_service
	except ImportError:
		from application.rag_service import get_rag_service
	try:
		asyncio.create_task(_warm_rag_service(get_rag_service))
	except Exception:
		logger.exception("RAG service warm-up could not be scheduled; API fallbacks remain available")


async def _warm_rag_service(get_service) -> None:
	try:
		await asyncio.to_thread(get_service)
	except Exception:
		logger.exception("RAG service could not initialize; API fallbacks remain available")


def _cors_origins() -> list[str]:
	configured = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
	return [origin.strip() for origin in configured.split(",") if origin.strip()]


app.add_middleware(
	CORSMiddleware,
	allow_origins=_cors_origins(),
	allow_credentials=False,
	allow_methods=["*"],
	allow_headers=["*"],
)
from fastapi.responses import JSONResponse
from fastapi import Request

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
	logger.exception("Unhandled API exception for %s", request.url.path)
	return JSONResponse(
		status_code=500,
		content={"detail": "Internal Server Error"},
	)

app.include_router(corpus_router, prefix="/api/corpus")
app.include_router(preprocessing_router, prefix="/api/preprocessing")
app.include_router(interpretation_router, prefix="/api/interpretation")
app.include_router(propositions_router, prefix="/api/propositions")
app.include_router(graph_router, prefix="/api/graph")
app.include_router(rag_router, prefix="/api/rag")
app.include_router(graph_status_router, prefix="/api/graph")
app.include_router(evaluation_router, prefix="/api/evaluation")
app.include_router(samples_router, prefix="/api/samples")


@app.get("/health")
def health() -> dict[str, str]:
	return {"status": "ok", "service": "silappatikaram-api"}
