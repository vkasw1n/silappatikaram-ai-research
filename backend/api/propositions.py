from typing import Optional

from fastapi import APIRouter, HTTPException

try:
    from ..application.proposition_service import generate_propositions
except ImportError:
    from application.proposition_service import generate_propositions

router = APIRouter()


@router.post("/generate")
def generate(passage_id: Optional[str] = None, include_custom: bool = False):
    try:
        return generate_propositions(passage_id, include_custom=include_custom)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error