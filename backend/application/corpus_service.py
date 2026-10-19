import io
import csv
import hashlib
import json
import uuid
from pathlib import Path
from typing import Optional
from fastapi import UploadFile

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB
EXPECTED_ID_COLUMNS = {
    "passage_id",
    "entity_id",
    "event_id",
    "relationship_id",
    "node_id",
}
RUNTIME_PATH = Path(__file__).resolve().parents[2] / ".runtime" / "user_corpora.json"


def _load_text_corpora() -> dict[str, dict[str, str]]:
    if not RUNTIME_PATH.is_file():
        return {}
    try:
        return json.loads(RUNTIME_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}


TEXT_CORPORA: dict[str, dict[str, str]] = _load_text_corpora()


def list_passages() -> list[dict[str, str]]:
    path = Path(__file__).resolve().parents[2] / "data" / "processed" / "passages.csv"
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def get_passage(passage_id: str) -> dict:
    passage = next((row for row in list_passages() if row["passage_id"] == passage_id), None)
    if passage is None:
        raise ValueError(f"Passage not found: {passage_id}")
    return passage


def build_text_metadata(text: str, filename: str = "entered_corpus.txt") -> dict:
    content = text.encode("utf-8")
    file_size = len(content)
    if file_size == 0 or not text.strip():
        raise ValueError("Text input cannot be empty")
    if file_size > MAX_FILE_SIZE:
        raise ValueError(f"Text input exceeds maximum allowed size of {MAX_FILE_SIZE} bytes")
    corpus_id = str(uuid.uuid4())
    TEXT_CORPORA[corpus_id] = {"text": text, "filename": filename}
    RUNTIME_PATH.parent.mkdir(parents=True, exist_ok=True)
    RUNTIME_PATH.write_text(json.dumps(TEXT_CORPORA, ensure_ascii=False, indent=2), encoding="utf-8")
    return {
        "corpus_id": corpus_id,
        "filename": filename,
        "file_type": "txt",
        "file_size": file_size,
        "language": "Tamil",
        "source_hash": hashlib.sha256(content).hexdigest(),
        "status": "text_entered",
        "context_text": text,
    }


def _store_uploaded_text(text: str, filename: str) -> str:
    if not text.strip():
        raise ValueError("The uploaded file contains no extractable text")
    corpus_id = str(uuid.uuid4())
    TEXT_CORPORA[corpus_id] = {"text": text, "filename": filename}
    RUNTIME_PATH.parent.mkdir(parents=True, exist_ok=True)
    RUNTIME_PATH.write_text(json.dumps(TEXT_CORPORA, ensure_ascii=False, indent=2), encoding="utf-8")
    return corpus_id

async def process_upload_file(file: Optional[UploadFile], use_prepared: bool) -> dict:
    if use_prepared:
        prepared_path = Path(__file__).resolve().parents[2] / "data" / "processed" / "passages.csv"
        if not prepared_path.is_file():
            raise ValueError("Prepared dataset is unavailable: data/processed/passages.csv was not found")
        content = prepared_path.read_bytes()
        corpus_id = str(uuid.uuid4())
        return {
            "corpus_id": corpus_id,
            "filename": prepared_path.name,
            "file_type": "csv",
            "file_size": len(content),
            "language": "Tamil",
            "source_hash": hashlib.sha256(content).hexdigest(),
            "status": "prepared_selected",
        }

    if file is None:
        raise ValueError("A file is required unless use_prepared is true")

    filename = file.filename or ""
    content = await file.read()
    file_size = len(content)

    if file_size == 0:
        raise ValueError("Empty file uploaded")

    if file_size > MAX_FILE_SIZE:
        raise ValueError(f"File exceeds maximum allowed size of {MAX_FILE_SIZE} bytes")

    lower = filename.lower()
    if not (lower.endswith(".pdf") or lower.endswith(".csv") or lower.endswith(".txt")):
        raise ValueError("Unsupported file extension. Only PDF, CSV and TXT are allowed")

    # compute sha256
    sha256 = hashlib.sha256(content).hexdigest()

    language = "Tamil"  # default for this project; could be detected later

    # CSV specific checks
    if lower.endswith(".csv"):
        try:
            text = content.decode("utf-8")
        except UnicodeDecodeError:
            raise ValueError("CSV file encoding is not UTF-8")
        buf = io.StringIO(text)
        try:
            reader = csv.DictReader(buf)
        except Exception:
            raise ValueError("Malformed CSV file")

        headers = reader.fieldnames
        if not headers:
            raise ValueError("CSV file has no header row")

        # check presence of at least one expected id column
        if not any(h in EXPECTED_ID_COLUMNS for h in headers):
            raise ValueError("CSV missing required identifier column (e.g., passage_id, entity_id)")

        # check duplicate ids if one of expected id columns present
        id_col = next((h for h in headers if h in EXPECTED_ID_COLUMNS), None)
        if id_col:
            ids = set()
            buf.seek(0)
            next(reader)  # move past header
            buf.seek(0)
            reader = csv.DictReader(io.StringIO(text))
            for i, row in enumerate(reader, start=1):
                val = row.get(id_col)
                if val is None or val == "":
                    raise ValueError(f"Missing ID value in column '{id_col}' at row {i}")
                if val in ids:
                    raise ValueError(f"Duplicate ID '{val}' found in column '{id_col}'")
                ids.add(val)

    # TXT specific checks: ensure UTF-8
    if lower.endswith(".txt"):
        try:
            text = content.decode("utf-8")
        except UnicodeDecodeError:
            raise ValueError("TXT file encoding is not UTF-8")

    if lower.endswith(".csv"):
        rows = list(csv.DictReader(io.StringIO(content.decode("utf-8"))))
        if "passage_text" in (headers or []):
            text = "\n".join(row.get("passage_text", "") for row in rows)
        else:
            text = "\n".join(", ".join(value for value in row.values() if value) for row in rows)

    if lower.endswith(".pdf"):
        try:
            from pypdf import PdfReader
        except ImportError as error:
            raise ValueError("PDF text extraction is unavailable; install backend requirements and try again") from error
        try:
            text = "\n".join(page.extract_text() or "" for page in PdfReader(io.BytesIO(content)).pages)
        except Exception as error:
            raise ValueError("PDF could not be read. Please upload a valid, text-based PDF") from error

    corpus_id = _store_uploaded_text(text, filename)
    return {
        "corpus_id": corpus_id,
        "filename": filename,
        "file_type": "pdf" if lower.endswith(".pdf") else ("csv" if lower.endswith(".csv") else "txt"),
        "file_size": file_size,
        "language": language,
        "source_hash": sha256,
        "status": "uploaded",
        "context_text": text,
    }
