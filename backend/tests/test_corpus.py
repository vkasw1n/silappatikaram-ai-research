from io import BytesIO

from fastapi.testclient import TestClient
from reportlab.pdfgen import canvas

try:
    from backend.main import app
except ModuleNotFoundError:
    from main import app

client = TestClient(app)

def test_valid_txt_upload():
    data = {"file": ("sample.txt", "சிலப்பதிகாரம்", "text/plain")}
    resp = client.post("/api/corpus/upload", files=data)
    assert resp.status_code == 200
    j = resp.json()
    assert j["filename"] == "sample.txt"
    assert j["file_type"] == "txt"

def test_valid_csv_upload():
    csv_content = "passage_id,kandam,passage_text\nP1,1,அறம் எனும்...\nP2,1,தினம்...\n"
    data = {"file": ("passages.csv", csv_content, "text/csv")}
    resp = client.post("/api/corpus/upload", files=data)
    assert resp.status_code == 200
    j = resp.json()
    assert j["filename"] == "passages.csv"
    assert j["file_type"] == "csv"


def test_valid_pdf_upload():
    output = BytesIO()
    document = canvas.Canvas(output)
    document.drawString(72, 720, "Kovalan anklet source passage")
    document.save()
    data = {"file": ("chapter.pdf", output.getvalue(), "application/pdf")}
    resp = client.post("/api/corpus/upload", files=data)
    assert resp.status_code == 200
    assert resp.json()["file_type"] == "pdf"
    processed = client.post("/api/preprocessing/run", params={"corpus_id": resp.json()["corpus_id"]})
    assert processed.status_code == 200
    assert "Kovalan anklet source passage" in processed.json()["passages"][0]["text"]

def test_empty_file():
    data = {"file": ("empty.txt", b"", "text/plain")}
    resp = client.post("/api/corpus/upload", files=data)
    assert resp.status_code == 400

def test_invalid_extension():
    data = {"file": ("malware.exe", b"data", "application/octet-stream")}
    resp = client.post("/api/corpus/upload", files=data)
    assert resp.status_code == 400

def test_oversized_file():
    # create payload larger than 10MB
    big = b"a" * (10 * 1024 * 1024 + 1)
    data = {"file": ("big.txt", big, "text/plain")}
    resp = client.post("/api/corpus/upload", files=data)
    assert resp.status_code == 400

def test_malformed_csv():
    # missing header
    csv_bytes = b"no,header\n1,2,3\n"
    data = {"file": ("bad.csv", csv_bytes, "text/csv")}
    resp = client.post("/api/corpus/upload", files=data)
    # The service expects an identifier column; this CSV won't have it
    assert resp.status_code == 400

def test_invalid_encoding_csv():
    bad = bytes([0xff, 0xfe, 0xff, 0xfe])
    data = {"file": ("weird.csv", bad, "text/csv")}
    resp = client.post("/api/corpus/upload", files=data)
    assert resp.status_code == 400


def test_prepared_dataset_selection_does_not_require_file():
    resp = client.post(
        "/api/corpus/upload",
        data={"use_prepared": "true"},
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "prepared_selected"


def test_text_input_upload_returns_sha256_metadata():
    text = "கோவலன் சிலம்புடன் மதுரைக்குச் சென்றான்."
    response = client.post("/api/corpus/text", json={"text": text})
    assert response.status_code == 200
    result = response.json()
    assert result["file_type"] == "txt"
    assert result["status"] == "text_entered"
    assert len(result["source_hash"]) == 64
    assert result["context_text"] == text


def test_empty_text_input_is_rejected():
    response = client.post("/api/corpus/text", json={"text": "   "})
    assert response.status_code == 400


def test_corpus_summary_uses_dataset_counts():
    response = client.get("/api/corpus/summary")
    assert response.status_code == 200
    assert response.json()["passages"] == 30
