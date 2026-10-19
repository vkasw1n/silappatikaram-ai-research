import csv
import hashlib
import json
import math
import os
import re
import time
import unicodedata
from collections import Counter
from pathlib import Path
from typing import Any

RAG_INDEX_VERSION = "rag-index-2"
DEFAULT_MODEL = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
PASSAGE_COLUMNS = {"passage_id", "kandam", "section_number", "section_name", "passage_text", "source_file", "page_start", "page_end"}
STOPWORDS = {"a", "an", "and", "are", "as", "at", "did", "do", "does", "for", "from", "how", "in", "is", "it", "of", "on", "or", "that", "the", "this", "to", "was", "what", "when", "where", "who", "why", "with"}


def tokens(value: str) -> list[str]:
    normalized = unicodedata.normalize("NFKC", value).casefold()
    return [token for token in re.findall(r"[\w\u0B80-\u0BFF]+", normalized) if len(token) > 1 and token not in STOPWORDS]


def passages_path() -> Path:
    return Path(__file__).resolve().parents[2] / "data" / "processed" / "passages.csv"


def index_dir() -> Path:
    project_root = Path(__file__).resolve().parents[2]
    configured = os.getenv("RAG_INDEX_DIR")
    if not configured:
        return project_root / ".rag_index"
    configured_path = Path(configured)
    return configured_path if configured_path.is_absolute() else project_root / configured_path


def load_passages() -> list[dict[str, str]]:
    with passages_path().open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        missing = PASSAGE_COLUMNS - set(reader.fieldnames or [])
        if missing:
            raise ValueError(f"passages.csv is missing columns: {', '.join(sorted(missing))}")
        return list(reader)


def dataset_hash(passages: list[dict[str, str]]) -> str:
    return hashlib.sha256("".join(json.dumps(row, ensure_ascii=False, sort_keys=True) for row in passages).encode("utf-8")).hexdigest()


class BM25Index:
    def __init__(self, passages: list[dict[str, str]], data: dict[str, Any] | None = None) -> None:
        self.passages = passages
        self.documents = [tokens(row["passage_text"]) for row in passages]
        self.doc_lengths = [len(doc) for doc in self.documents]
        self.avgdl = sum(self.doc_lengths) / max(1, len(self.documents))
        self.k1 = 1.5
        self.b = 0.75

        # Build fast inverted index: term -> list of (doc_index, term_frequency)
        self.inverted_index: dict[str, list[tuple[int, int]]] = {}
        for idx, doc in enumerate(self.documents):
            counts = Counter(doc)
            for term, freq in counts.items():
                self.inverted_index.setdefault(term, []).append((idx, freq))

        self.document_frequency = {term: len(postings) for term, postings in self.inverted_index.items()}
        if data:
            self.document_frequency = data.get("document_frequency", self.document_frequency)
            self.avgdl = data.get("avgdl", self.avgdl)

    def search(self, query: str, limit: int) -> list[tuple[int, float]]:
        query_terms = tokens(query)
        if not query_terms:
            return []

        doc_scores: dict[int, float] = {}
        count = len(self.documents)

        # Evaluate only documents containing query terms (ultra-fast)
        for term in set(query_terms):
            postings = self.inverted_index.get(term)
            if not postings:
                continue
            df = len(postings)
            idf = math.log(1 + (count - df + 0.5) / (df + 0.5))
            for doc_idx, freq in postings:
                length = self.doc_lengths[doc_idx]
                score = idf * freq * (self.k1 + 1) / (freq + self.k1 * (1 - self.b + self.b * length / max(1, self.avgdl)))
                doc_scores[doc_idx] = doc_scores.get(doc_idx, 0.0) + score

        scores = [(idx, score) for idx, score in doc_scores.items() if score > 0]
        return sorted(scores, key=lambda item: (-item[1], self.passages[item[0]]["passage_id"]))[:limit]

    def serialize(self) -> dict[str, Any]:
        return {"avgdl": self.avgdl, "document_frequency": self.document_frequency}


class DenseEmbeddingProvider:
    def __init__(self, model_name: str | None = None) -> None:
        self.model_name = model_name or os.getenv("RAG_EMBEDDING_MODEL", DEFAULT_MODEL)
        self.model = None
        self.error = None
        self._encode_cache: dict[str, list[float]] = {}
        if os.getenv("RAG_DENSE_ENABLED", "true").casefold() == "true":
            try:
                from sentence_transformers import SentenceTransformer
                self.model = SentenceTransformer(self.model_name)
            except Exception as error:  # optional heavyweight dependency
                self.error = str(error)

    @property
    def enabled(self) -> bool:
        return self.model is not None

    def encode(self, texts: list[str]) -> list[list[float]]:
        if not self.model:
            return []
        uncached_indices = []
        uncached_texts = []
        results: list[list[float] | None] = [None] * len(texts)

        for idx, text in enumerate(texts):
            if text in self._encode_cache:
                results[idx] = self._encode_cache[text]
            else:
                uncached_indices.append(idx)
                uncached_texts.append(text)

        if uncached_texts:
            embeddings = self.model.encode(uncached_texts, normalize_embeddings=True, show_progress_bar=False).tolist()
            for idx, text, emb in zip(uncached_indices, uncached_texts, embeddings):
                self._encode_cache[text] = emb
                results[idx] = emb

        return [r for r in results if r is not None]

    def search(self, query: str, vectors: list[list[float]], limit: int) -> list[tuple[int, float]]:
        if not self.model or not vectors:
            return []
        query_vectors = self.encode([query])
        if not query_vectors:
            return []
        query_vector = query_vectors[0]

        # Use numpy matrix multiplication if available for massive speedup
        try:
            import numpy as np
            q_vec = np.array(query_vector, dtype=np.float32)
            mat = np.array(vectors, dtype=np.float32)
            scores = np.dot(mat, q_vec).tolist()
            results = list(enumerate(scores))
        except ImportError:
            results = [(index, sum(a * b for a, b in zip(query_vector, vector))) for index, vector in enumerate(vectors)]

        return sorted(results, key=lambda item: (-item[1], self.model_name))[:limit]


class RAGIndex:
    def __init__(self) -> None:
        self.passages = load_passages()
        self.dataset_hash = dataset_hash(self.passages)
        self.model_name = os.getenv("RAG_EMBEDDING_MODEL", DEFAULT_MODEL)
        self.bm25: BM25Index
        self.vectors: list[list[float]] = []
        self.metadata: dict[str, Any] = {}
        self.embedding_provider = DenseEmbeddingProvider(self.model_name)
        self._load_or_prepare()

    def _load_or_prepare(self) -> None:
        metadata_path = index_dir() / "rag_index_metadata.json"
        bm25_path = index_dir() / "bm25.json"
        vector_path = index_dir() / "vectors.json"
        records_path = index_dir() / "passage_records.json"
        if metadata_path.is_file() and bm25_path.is_file():
            self.metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
            if self.metadata.get("dataset_hash") == self.dataset_hash and self.metadata.get("embedding_model") == self.model_name and records_path.is_file():
                self.bm25 = BM25Index(self.passages, json.loads(bm25_path.read_text(encoding="utf-8")))
                if vector_path.is_file():
                    self.vectors = json.loads(vector_path.read_text(encoding="utf-8"))
                return
        self.bm25 = BM25Index(self.passages)
        self.metadata = {"index_version": RAG_INDEX_VERSION, "dataset_hash": self.dataset_hash, "embedding_model": self.model_name, "embedding_dimension": 0, "document_count": len(self.passages), "created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "stale": True, "dense_available": self.embedding_provider.enabled}

    def build(self) -> dict[str, Any]:
        index_dir().mkdir(parents=True, exist_ok=True)
        self.vectors = self.embedding_provider.encode([row["passage_text"] for row in self.passages])
        self.metadata.update({"index_version": RAG_INDEX_VERSION, "dataset_hash": self.dataset_hash, "embedding_model": self.model_name, "embedding_dimension": len(self.vectors[0]) if self.vectors else 0, "document_count": len(self.passages), "created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "stale": False, "dense_available": bool(self.vectors)})
        (index_dir() / "rag_index_metadata.json").write_text(json.dumps(self.metadata, ensure_ascii=False, indent=2), encoding="utf-8")
        (index_dir() / "bm25.json").write_text(json.dumps(self.bm25.serialize(), ensure_ascii=False), encoding="utf-8")
        (index_dir() / "vectors.json").write_text(json.dumps(self.vectors, ensure_ascii=False), encoding="utf-8")
        records = [{"passage_id": row["passage_id"], "text": row["passage_text"], "kandam": row["kandam"], "section_number": row["section_number"], "section_name": row["section_name"], "source_file": row["source_file"], "page_start": row["page_start"], "page_end": row["page_end"]} for row in self.passages]
        (index_dir() / "passage_records.json").write_text(json.dumps(records, ensure_ascii=False, indent=2), encoding="utf-8")
        return self.metadata

    def status(self) -> dict[str, Any]:
        return {"index_version": self.metadata.get("index_version"), "index_stale": self.metadata.get("stale", True), "document_count": len(self.passages), "embedding_model": self.model_name, "dense_enabled": bool(self.vectors) and self.embedding_provider.enabled, "dense_error": self.embedding_provider.error}