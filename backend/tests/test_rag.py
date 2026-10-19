from io import BytesIO
import re

from fastapi.testclient import TestClient
from pypdf import PdfReader

try:
    from backend.main import app
except ModuleNotFoundError:
    from main import app


client = TestClient(app)


def test_rag_returns_original_passage_evidence():
    response = client.post("/api/rag/query", json={"query": "Kovalan anklet", "top_k": 5})
    assert response.status_code == 200
    result = response.json()
    assert result["status"] == "SUCCESS"
    assert result["entities"]
    assert result["evidence"]
    item = result["evidence"][0]
    assert item["passage_id"]
    assert item["passage_text"]
    assert item["source_file"]
    assert item["page_start"]
    assert item["retrieval_method"]
    assert "relevance_score" in item
    assert item["relevance_score"] > 0
    assert item["provenance"]
    assert result["conclusion"] is None
    assert result["answer_mode"] in {"llm", "evidence_only_fallback"}
    assert result["answer"]


def test_tamil_query_is_supported():
    response = client.post("/api/rag/query", json={"query": "கோவலன்", "top_k": 3})
    assert response.status_code == 200
    assert response.json()["status"] in {"SUCCESS", "INSUFFICIENT_EVIDENCE"}


def test_unknown_query_returns_insufficient_evidence():
    response = client.post("/api/rag/query", json={"query": "unknown literary object xyz", "top_k": 5})
    assert response.status_code == 200
    result = response.json()
    assert result["status"] == "INSUFFICIENT_EVIDENCE"
    assert result["evidence"] == []
    assert result["conclusion"] is None


def test_empty_query_is_rejected():
    response = client.post("/api/rag/query", json={"query": "", "top_k": 5})
    assert response.status_code == 422


def test_rag_diagnostics_report_explicit_fallbacks_and_cache():
    payload = {"query": "Kovalan anklet", "top_k": 2, "use_dense": False}
    first = client.post("/api/rag/query", json=payload).json()
    second = client.post("/api/rag/query", json=payload).json()
    assert first["retrieval_metadata"]["bm25_enabled"] is True
    assert first["retrieval_metadata"]["graph_backend"] == "csv_fallback"
    assert first["retrieval_metadata"]["dense_enabled"] is False
    assert second["retrieval_metadata"]["cache_hit"] is True


def test_kandam_filter_is_applied_before_final_evidence():
    response = client.post("/api/rag/query", json={"query": "Kovalan", "top_k": 5, "filters": {"kandam": "Maturai Kāṇṭam"}})
    assert response.status_code == 200
    for item in response.json()["evidence"]:
        assert item["kandam"] == "Maturai Kāṇṭam"


def test_evidence_report_is_generated_server_side():
    response = client.post("/api/rag/evidence.pdf", json={"query": "Kovalan anklet", "top_k": 2})
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert response.content.startswith(b"%PDF-")
    text = "\n".join(page.extract_text() or "" for page in PdfReader(BytesIO(response.content)).pages)
    assert "Kovalan anklet" in text
    assert "E1" in text
    assert "Source PDF:" in text


def test_tamil_evidence_report_embeds_fonts_and_keeps_real_corpus_text():
    from backend.application.evidence_report import build_evidence_pdf

    query = "கோவலன் ஏன் மதுரைக்குச் சென்றான்?"
    result = client.post("/api/rag/query", json={"query": query, "top_k": 2}).json()
    assert result["evidence"]
    result["answer"] = "ஆதாரத்தைத் தவிர வேறு முடிவு கூறப்படவில்லை."
    pdf = build_evidence_pdf(result)
    pages = PdfReader(BytesIO(pdf)).pages
    extracted = "\n".join(page.extract_text() or "" for page in pages)
    normalized = re.sub(r"\s+", "", extracted)

    assert query in extracted
    assert result["answer"] in extracted
    assert "Silappatikāram" in extracted

    for evidence in result["evidence"]:
        tamil_runs = re.findall(r"[\u0b80-\u0bff]{8,}", evidence["passage_text"])
        if tamil_runs:
            assert tamil_runs[0] in normalized
            assert tamil_runs[-1] in normalized

    embedded_font_count = 0
    for page in pages:
        for reference in page["/Resources"]["/Font"].values():
            font = reference.get_object()
            descriptors = []
            if font.get("/FontDescriptor"):
                descriptors.append(font["/FontDescriptor"].get_object())
            for descendant in font.get("/DescendantFonts", []):
                descendant_font = descendant.get_object()
                if descendant_font.get("/FontDescriptor"):
                    descriptors.append(descendant_font["/FontDescriptor"].get_object())
            embedded_font_count += sum(bool(descriptor.get("/FontFile2")) for descriptor in descriptors)
    assert embedded_font_count >= 2


def test_custom_context_enriches_retrieval_without_replacing_question():
    question = "Did Kovalan steal the queen's anklet?"
    response = client.post("/api/rag/query", json={
        "query": question,
        "context": "கோவலன் சிலம்பு மதுரை",
        "top_k": 3,
    })
    assert response.status_code == 200
    result = response.json()
    assert result["query"] == question
    assert result["retrieval_metadata"]["context_used"] is True
    assert result["retrieval_metadata"]["context_characters"] > 0