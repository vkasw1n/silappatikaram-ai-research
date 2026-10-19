from typing import Any, Optional

from pydantic import BaseModel


class EvidenceItem(BaseModel):
    evidence_id: str
    passage_id: str
    passage_text: str
    kandam: str
    section_number: str
    section_name: str
    source_file: str
    page_start: str
    page_end: str
    retrieval_methods: list[str]
    dense_score: float
    bm25_score: float
    graph_score: float
    rrf_score: float
    reranker_score: float
    final_score: float
    matched_entities: list[str]
    matched_events: list[str]
    matched_relationships: list[str]
    graph_backend: str
    provenance: list[dict[str, Any]]
    source_dataset: str
    source_pdf: str
    source_pages: str
    retrieval_method: Optional[str] = None