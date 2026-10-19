import random
import re
from pathlib import Path
from functools import lru_cache
from typing import Literal

from fastapi import APIRouter, Query

router = APIRouter()

_SAMPLE_PATH = Path(__file__).resolve().parents[2] / "data" / "silappatikaram_sample_queries_1000.txt"
_TAMIL_RE = re.compile(r"[\u0B80-\u0BFF]")


def _language(query: str) -> Literal["en", "ta"]:
    return "ta" if _TAMIL_RE.search(query) else "en"


def _category(query: str) -> str:
    normalized = query.casefold()
    groups = {
        "evidence": ("evidence", "ஆதாரம்", "உரைச்சான்று", "passage", "provenance", "ஆதார"),
        "graph": ("graph", "கிராஃப்", "relationship", "உறவு", "entity", "நபர்", "path", "பாதை"),
        "interpretation": ("interpretation", "விளக்கம்", "context", "சூழல்", "meaning", "மையப் பொருள்"),
        "verification": ("verify", "சரிபார்", "sufficient", "போதிய", "explicitly", "நேரடியாக", "unsupported", "ஆதாரமற்ற"),
    }
    for name, terms in groups.items():
        if any(term in normalized for term in terms):
            return name
    return "corpus"


@lru_cache(maxsize=1)
def _load_queries() -> list[dict[str, str | int]]:
    if not _SAMPLE_PATH.exists():
        return []
    return [
        {"id": index, "text": text, "language": _language(text), "category": _category(text)}
        for index, text in enumerate(_SAMPLE_PATH.read_text(encoding="utf-8").splitlines(), start=1)
        if text.strip()
    ]


@router.get("")
def sample_queries(
    search: str = Query("", max_length=300),
    language: Literal["all", "en", "ta"] = "all",
    category: str = Query("all", pattern="^(all|corpus|evidence|graph|interpretation|verification)$"),
    limit: int = Query(40, ge=1, le=100),
    random_sample: bool = Query(False),
):
    queries = _load_queries()
    needle = search.casefold().strip()
    filtered = [
        item for item in queries
        if (language == "all" or item["language"] == language)
        and (category == "all" or item["category"] == category)
        and (not needle or needle in str(item["text"]).casefold())
    ]
    if random_sample:
        filtered = random.sample(filtered, min(limit, len(filtered)))
    else:
        filtered = filtered[:limit]
    return {
        "queries": filtered,
        "total": len(filtered),
        "available": len(queries),
        "languages": {"en": sum(item["language"] == "en" for item in queries), "ta": sum(item["language"] == "ta" for item in queries)},
        "categories": sorted({str(item["category"]) for item in queries}),
    }