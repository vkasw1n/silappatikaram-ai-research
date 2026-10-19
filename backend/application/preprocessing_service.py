import csv
import re
import time
import unicodedata
from pathlib import Path
from typing import Any

PROCESSING_VERSION = "module-2-fallback-1.0"
REQUIRED_PASSAGE_COLUMNS = {
    "passage_id", "kandam", "section_number", "section_name",
    "page_start", "page_end", "passage_text", "source_file",
}
REQUIRED_ENTITY_COLUMNS = {
    "entity_id", "entity_name_tamil", "entity_name_english", "entity_type",
    "passage_id", "kandam", "section_number", "section_name", "mention_count",
    "source_file", "source_page_start", "source_page_end",
}


def _dataset_path(filename: str) -> Path:
    return Path(__file__).resolve().parents[2] / "data" / "processed" / filename


def _read_csv(path: Path, required_columns: set[str]) -> list[dict[str, str]]:
    if not path.is_file():
        raise ValueError(f"Dataset is unavailable: {path.name} was not found")
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        headers = set(reader.fieldnames or [])
        missing = sorted(required_columns - headers)
        if missing:
            raise ValueError(f"{path.name} is missing required columns: {', '.join(missing)}")
        return list(reader)


def _normalize(text: str) -> str:
    normalized = unicodedata.normalize("NFKC", text)
    return re.sub(r"\s+", " ", normalized).strip()


def _sentences(text: str) -> list[str]:
    return [part.strip() for part in re.split(r"(?<=[.!?।॥])\s+|\n+", text) if part.strip()]


def run_preprocessing(corpus_id: str | None = None) -> dict[str, Any]:
    started = time.perf_counter()
    if corpus_id:
        try:
            from .corpus_service import TEXT_CORPORA
        except ImportError:
            from application.corpus_service import TEXT_CORPORA
        if corpus_id not in TEXT_CORPORA:
            raise ValueError(f"Corpus session not found: {corpus_id}")
        corpus = TEXT_CORPORA[corpus_id]
        passage_rows = [{"passage_id": f"{corpus_id}:P001", "kandam": "User-entered corpus", "section_number": "1", "section_name": "Entered text", "page_start": "-", "page_end": "-", "passage_text": corpus["text"], "source_file": corpus["filename"]}]
        entity_rows = []
    else:
        passage_rows = _read_csv(_dataset_path("passages.csv"), REQUIRED_PASSAGE_COLUMNS)
        entity_rows = _read_csv(_dataset_path("entities.csv"), REQUIRED_ENTITY_COLUMNS)
    processed_passages = []
    sentence_count = 0
    concepts = []
    for row in passage_rows:
        normalized = _normalize(row["passage_text"])
        sentences = _sentences(normalized)
        sentence_count += len(sentences)
        processed_passages.append({
            "passage_id": row["passage_id"],
            "kandam": row["kandam"],
            "section_number": row["section_number"],
            "section_name": row["section_name"],
            "source_file": row["source_file"],
            "page_start": row["page_start"],
            "page_end": row["page_end"],
            "text": normalized,
            "sentences": sentences,
            "tokens": normalized.split(),
        })
    for entity in entity_rows:
        concepts.append({
            "word": entity["entity_name_tamil"],
            "english": entity["entity_name_english"],
            "entity_id": entity["entity_id"],
            "type": entity["entity_type"],
            "passage_id": entity["passage_id"],
            "method": "prepared entities.csv",
            "confidence": 1.0,
        })
    linked_entities = [{
        "entity_id": row["entity_id"],
        "entity_name_tamil": row["entity_name_tamil"],
        "entity_name_english": row["entity_name_english"],
        "entity_type": row["entity_type"],
        "passage_id": row["passage_id"],
        "source_file": row["source_file"],
        "source_page_start": row["source_page_start"],
        "source_page_end": row["source_page_end"],
        "method": "prepared entities.csv exact passage link",
        "confidence": 1.0,
    } for row in entity_rows]
    return {
        "processing_version": PROCESSING_VERSION,
        "method": "deterministic Unicode and whitespace fallback; prepared entity links",
        "capabilities": {
            "normalization": "available",
            "tokenization": "fallback_whitespace",
            "sentence_segmentation": "fallback_punctuation_and_newline",
            "morphology": "unavailable",
            "pos": "unavailable",
            "ner": "prepared_entities_only",
            "entity_linking": "prepared_exact_passage_link",
            "semantic_representation": "passage_sentence_token_record",
        },
        "passage_count": len(processed_passages),
        "sentence_count": sentence_count,
        "entity_count": len(linked_entities),
        "processing_time_ms": round((time.perf_counter() - started) * 1000, 2),
        "passages": processed_passages,
        "entities": linked_entities,
        "concepts": concepts,
        "parsed_structure": [{
            "passage_id": passage["passage_id"],
            "root": passage["sentences"][0] if passage["sentences"] else passage["text"],
            "tokens": [{"text": token, "pos": "unavailable", "lemma": "unavailable"} for token in passage["tokens"]],
            "method": "fallback token record; Tamil POS and morphology unavailable",
        } for passage in processed_passages],
    }