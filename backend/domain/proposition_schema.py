from pydantic import BaseModel, validator


class PropositionSchema(BaseModel):
    proposition_id: str
    subject: str
    predicate: str
    object: str
    type: str
    source_passage: str
    source_page: str
    evidence_id: str
    confidence: float
    natural_language: str
    evidence: str
    source_file: str
    formal_formula: str = ""
    fol_predicate: str = ""

    @validator("type")
    def supported_type(cls, value: str) -> str:
        if value not in {"FACT", "EVIDENCE", "INTERPRETATION", "ASSUMPTION"}:
            raise ValueError("Unsupported proposition type")
        return value

    @validator("confidence")
    def valid_confidence(cls, value: float) -> float:
        if not 0 <= value <= 1:
            raise ValueError("Confidence must be between 0 and 1")
        return value