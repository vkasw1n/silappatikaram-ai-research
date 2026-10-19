from pydantic import BaseModel
from typing import Optional

class CorpusInputResponse(BaseModel):
    corpus_id: str
    filename: str
    file_type: str
    file_size: int
    language: Optional[str]
    source_hash: Optional[str]
    status: str
    context_text: Optional[str] = None
