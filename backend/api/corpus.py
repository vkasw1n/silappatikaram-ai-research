import csv
from typing import Optional

from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from pydantic import BaseModel

try:
    from ..application.corpus_service import build_text_metadata, get_passage, list_passages, process_upload_file
    from ..domain.schemas import CorpusInputResponse
except ImportError:
    from application.corpus_service import build_text_metadata, get_passage, list_passages, process_upload_file
    from domain.schemas import CorpusInputResponse

router = APIRouter()


class TextCorpusRequest(BaseModel):
    text: str
    filename: str = "entered_corpus.txt"


@router.get("/passages")
def passages():
    return {"passages": list_passages()}


@router.get("/summary")
def corpus_summary():
    root = __import__("pathlib").Path(__file__).resolve().parents[2] / "data"
    counts = {}
    for name, location in (("passages", root / "processed" / "passages.csv"), ("entities", root / "processed" / "entities.csv"), ("events", root / "processed" / "events.csv"), ("relationships", root / "processed" / "relationships.csv")):
        with location.open("r", encoding="utf-8-sig", newline="") as handle:
            counts[name] = max(0, sum(1 for _ in csv.DictReader(handle)))
    return {"corpus": "Silappatikāram", **counts}


@router.get("/passages/{passage_id}")
def passage(passage_id: str):
    try:
        return get_passage(passage_id)
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error

@router.post("/upload", response_model=CorpusInputResponse)
async def upload_corpus(
    file: Optional[UploadFile] = File(None),
    use_prepared: bool = Form(False),
):
    try:
        result = await process_upload_file(file, use_prepared)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/text", response_model=CorpusInputResponse)
def enter_corpus_text(request: TextCorpusRequest):
    try:
        return build_text_metadata(request.text, request.filename)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
