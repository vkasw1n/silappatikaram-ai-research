from typing import Optional

from fastapi import APIRouter, HTTPException

try:
    from ..application.mimamsa_service import run_interpretation
except ImportError:
    from application.mimamsa_service import run_interpretation

router = APIRouter()


@router.post("/run")
def interpret_corpus(passage_id: Optional[str] = None):
    try:
        return run_interpretation(passage_id)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error