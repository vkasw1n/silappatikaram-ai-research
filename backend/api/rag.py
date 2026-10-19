from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from typing import Optional

from pydantic import BaseModel, validator

try:
    from ..application.rag_service import get_rag_service
except ImportError:
    from application.rag_service import get_rag_service

router = APIRouter()


class RAGQueryRequest(BaseModel):
    query: str
    context: Optional[str] = None
    top_k: int = 5
    filters: Optional[dict[str, str]] = None
    use_dense: bool = True
    use_bm25: bool = True
    use_graph: bool = True
    use_reranker: bool = True

    @validator("query")
    def query_required(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("query must not be empty")
        return value

    @validator("top_k")
    def top_k_valid(cls, value: int) -> int:
        if not 1 <= value <= 50:
            raise ValueError("top_k must be between 1 and 50")
        return value


@router.post("/query")
def query_rag(request: RAGQueryRequest):
    try:
        return get_rag_service().query(
            request.query,
            request.top_k,
            request.filters,
            request.use_dense,
            request.use_bm25,
            request.use_graph,
            request.use_reranker,
            request.context,
        )
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@router.post("/evidence.pdf")
def download_evidence_pdf(request: RAGQueryRequest):
    try:
        result = get_rag_service().query(
            request.query,
            request.top_k,
            request.filters,
            request.use_dense,
            request.use_bm25,
            request.use_graph,
            request.use_reranker,
            request.context,
        )
        try:
            from ..application.evidence_report import build_evidence_pdf
        except ImportError:
            from application.evidence_report import build_evidence_pdf
        return Response(
            content=build_evidence_pdf(result),
            media_type="application/pdf",
            headers={"Content-Disposition": 'attachment; filename="silappatikaram-evidence.pdf"'},
        )
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except RuntimeError as error:
        raise HTTPException(
            status_code=503,
            detail="Tamil Unicode font configuration is unavailable. Install Latha/Nirmala UI or configure a Tamil font and retry.",
        ) from error