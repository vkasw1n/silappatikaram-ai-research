from typing import Optional

from fastapi import APIRouter, HTTPException

try:
    from ..application.preprocessing_service import run_preprocessing
except ImportError:
    from application.preprocessing_service import run_preprocessing

router = APIRouter()


@router.post("/run")
def preprocess_corpus(corpus_id: Optional[str] = None):
    try:
        return run_preprocessing(corpus_id)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error