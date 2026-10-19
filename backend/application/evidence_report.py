import html
import io
import os
import re
import unicodedata
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def _font_paths() -> tuple[Path, Path | None, Path, Path | None]:
    configured_path = os.getenv("SILAPATHIKARAM_TAMIL_FONT")
    bundled_font = Path(__file__).resolve().parents[2] / "assets" / "fonts" / "NotoSansTamil[wght].ttf"
    tamil_candidates = [
        (Path(configured_path), None) if configured_path else None,
        (bundled_font, None),
        (Path("C:/Windows/Fonts/NotoSansTamil-Regular.ttf"), Path("C:/Windows/Fonts/NotoSansTamil-Bold.ttf")),
        (Path("C:/Windows/Fonts/NotoSerifTamil-Regular.ttf"), Path("C:/Windows/Fonts/NotoSerifTamil-Bold.ttf")),
        (Path("C:/Windows/Fonts/Nirmala.ttc"), None),
        (Path("C:/Windows/Fonts/NirmalaUI.ttf"), Path("C:/Windows/Fonts/NirmalaUI-Bold.ttf")),
        (Path("C:/Windows/Fonts/latha.ttf"), Path("C:/Windows/Fonts/lathab.ttf")),
        (Path("C:/Windows/Fonts/vijaya.ttf"), Path("C:/Windows/Fonts/vijayab.ttf")),
        (Path("/usr/share/fonts/truetype/noto/NotoSansTamil-Regular.ttf"), Path("/usr/share/fonts/truetype/noto/NotoSansTamil-Bold.ttf")),
        (Path("/usr/share/fonts/truetype/noto/NotoSerifTamil-Regular.ttf"), Path("/usr/share/fonts/truetype/noto/NotoSerifTamil-Bold.ttf")),
    ]
    latin_candidates = [
        (Path(os.getenv("SILAPATHIKARAM_LATIN_FONT", "C:/Windows/Fonts/arial.ttf")), Path("C:/Windows/Fonts/arialbd.ttf")),
        (Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"), Path("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf")),
        (Path("/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf"), Path("/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf")),
    ]

    def find_font(candidates: list[tuple[Path, Path | None] | None], script: str) -> tuple[Path, Path | None]:
        for candidate in candidates:
            if candidate is None:
                continue
            regular, bold = candidate
            if regular.is_file():
                return regular, bold if bold and bold.is_file() else None
        raise RuntimeError(f"{script} Unicode font unavailable. Configure SILAPATHIKARAM_{script.upper()}_FONT.")

    tamil_regular, tamil_bold = find_font(tamil_candidates, "Tamil")
    latin_regular, latin_bold = find_font(latin_candidates, "Latin")
    return tamil_regular, tamil_bold, latin_regular, latin_bold


# A run of Tamil characters, including spaces *between* Tamil words, so that the
# whole phrase is shaped with the Tamil font in one piece (ZWJ/ZWNJ included).
_TAMIL_CHARS = "\u0b80-\u0bff\u200c\u200d"
_TAMIL_RUN = re.compile(rf"[{_TAMIL_CHARS}]+(?:[ ]+[{_TAMIL_CHARS}]+)*")

# Verse structure markers found in the canonical text.
_LINE_NUMBER = re.compile(r"^\s*\d{1,4}\s*$")                 # e.g. "60", "115"
_CANTO_TITLE = re.compile(r"^\s*\d+\s*[.\)]\s+\S")             # e.g. "1. மங்கல வாழ்த்துப் பாடல்"
_METRE_LABEL = re.compile(r"^\s*[\(（].{1,80}[\)）]\s*$")       # e.g. "(நிலைமண்டில ஆசிரியப்பா)"


def _require_shaping(face: Any) -> None:
    """Tamil needs OpenType shaping (uharfbuzz). Without it vowel signs/conjuncts render wrongly."""
    if not face.shapable:
        raise RuntimeError("Tamil text shaping is unavailable. Install uharfbuzz before generating this report.")


def build_evidence_pdf(result: dict[str, Any]) -> bytes:
    from reportlab.lib import colors
    from reportlab.lib.enums import TA_LEFT, TA_RIGHT
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
    from reportlab.platypus import KeepTogether, Paragraph, SimpleDocTemplate, Spacer

    tamil_regular, tamil_bold, latin_regular, latin_bold = _font_paths()
    tamil_name = "SilappatikaramTamil"
    tamil_bold_name = "SilappatikaramTamilBold"
    latin_name = "SilappatikaramLatin"
    latin_bold_name = "SilappatikaramLatinBold"
    font_paths = {
        tamil_name: tamil_regular,
        tamil_bold_name: tamil_bold or tamil_regular,
        latin_name: latin_regular,
        latin_bold_name: latin_bold or latin_regular,
    }
    font_faces = {
        name: TTFont(name, str(path), shapable=name.startswith("SilappatikaramTamil"))
        for name, path in font_paths.items()
    }
    _require_shaping(font_faces[tamil_name])
    for value in _report_strings(result):
        for character in value:
            is_tamil = "\u0b80" <= character <= "\u0bff"
            if character.isspace() or ord(character) < 128:
                continue
            if unicodedata.category(character) == "Cf":  # ZWJ / ZWNJ and other format characters
                continue
            font_name = tamil_name if is_tamil else latin_name
            if ord(character) not in font_faces[font_name].face.charToGlyph:
                raise RuntimeError(f"Unicode font is missing required character U+{ord(character):04X}.")
    registered = set(pdfmetrics.getRegisteredFontNames())
    for name, face in font_faces.items():
        if name not in registered:
            pdfmetrics.registerFont(face)
    pdfmetrics.registerFontFamily(latin_name, normal=latin_name, bold=latin_bold_name, italic=latin_name, boldItalic=latin_bold_name)

    # NOTE: wordWrap="CJK" was removed. CJK wrapping allows a line break between ANY two
    # characters, which cut Tamil words in the middle (e.g. "வாழ்த்துப்" / "பாடல்").
    # The default wrapper breaks only at spaces, so Tamil words stay whole.
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(name="ReportTitle", parent=styles["Title"], fontName=latin_bold_name, fontSize=20, leading=27, textColor=colors.HexColor("#183653"), alignment=TA_LEFT, spaceAfter=8))
    styles.add(ParagraphStyle(name="Section", parent=styles["Heading2"], fontName=latin_bold_name, fontSize=14, leading=20, textColor=colors.HexColor("#17665f"), spaceBefore=16, spaceAfter=7, keepWithNext=1))
    styles.add(ParagraphStyle(name="BodyReadable", parent=styles["BodyText"], fontName=latin_name, fontSize=11, leading=19, textColor=colors.HexColor("#243b53"), spaceAfter=7))
    styles.add(ParagraphStyle(name="Metadata", parent=styles["BodyText"], fontName=latin_name, fontSize=9.5, leading=16, textColor=colors.HexColor("#536b7f"), spaceAfter=3))
    # Verse lines: one paragraph per poetic line, with a hanging indent so that a
    # line that is too long for the page continues visibly indented.
    styles.add(ParagraphStyle(name="VerseLine", parent=styles["BodyText"], fontName=tamil_name, fontSize=11.5, leading=21, textColor=colors.HexColor("#1e293b"), leftIndent=34, firstLineIndent=-14, spaceBefore=0, spaceAfter=0, wordWrap="LTR", allowWidows=1, allowOrphans=1))
    styles.add(ParagraphStyle(name="VerseTitle", parent=styles["VerseLine"], fontName=tamil_bold_name, fontSize=13, leading=22, textColor=colors.HexColor("#17665f"), leftIndent=20, firstLineIndent=0, spaceBefore=4, spaceAfter=2, keepWithNext=1))
    styles.add(ParagraphStyle(name="VerseNumber", parent=styles["BodyText"], fontName=latin_name, fontSize=8, leading=9, textColor=colors.HexColor("#94a3b8"), alignment=TA_RIGHT, spaceBefore=0, spaceAfter=0))
    styles.add(ParagraphStyle(name="VerseMetre", parent=styles["VerseLine"], fontSize=10, leading=17, textColor=colors.HexColor("#62788a"), leftIndent=20, firstLineIndent=0, spaceAfter=6, keepWithNext=1))

    def inline_markup(text: str, tamil: bool = False) -> str:
        """Escape text and wrap Tamil runs in the Tamil font (whole phrases, not word-by-word)."""
        leading_spaces = len(text) - len(text.lstrip(" "))
        content = html.escape(text[leading_spaces:], quote=False)
        if leading_spaces:
            content = "&nbsp;" * leading_spaces + content
        if tamil:
            return f'<font name="{tamil_name}">{content}</font>'
        return _TAMIL_RUN.sub(lambda m: f'<font name="{tamil_name}">{m.group(0)}</font>', content)

    def paragraph(value: Any, style: str = "BodyReadable") -> Paragraph:
        raw = str(value or "")
        markup = "<br/>".join(inline_markup(line) for line in raw.split("\n"))
        return Paragraph(markup, styles[style])

    def verse_flowables(value: Any) -> list[Any]:
        """One flowable per source line, in source order. No text is added, dropped, merged or moved;
        only the styling differs (canto title, metre label, stand-alone line number, verse line)."""
        lines = str(value or "").replace("\r\n", "\n").replace("\r", "\n").split("\n")
        flowables: list[Any] = []
        text_seen = False
        for line in lines:
            line = line.rstrip()
            if not line.strip():
                flowables.append(Spacer(1, 6))
                continue
            if _LINE_NUMBER.match(line):
                flowables.append(Paragraph(f'<font name="{latin_name}">{html.escape(line.strip())}</font>', styles["VerseNumber"]))
                continue
            if not text_seen and _CANTO_TITLE.match(line):
                style = "VerseTitle"
            elif _METRE_LABEL.match(line):
                style = "VerseMetre"
            else:
                style = "VerseLine"
            text_seen = True
            flowables.append(Paragraph(inline_markup(line, tamil=True), styles[style]))
        return flowables

    buffer = io.BytesIO()
    document = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=48, leftMargin=48, topMargin=52, bottomMargin=48, initialFontName=latin_name, initialFontSize=10, title="Silappatikāram Evidence Report", author="Silappatikāram Research Workspace")
    generated_at = datetime.now(timezone.utc).isoformat(timespec="seconds")
    story = [
        paragraph("Silappatikāram Evidence Report", "ReportTitle"),
        paragraph("This report presents the current question and evidence retrieved from the canonical literary corpus. The answer is generated from retrieved evidence; unsupported literary claims are not asserted.", "Metadata"),
        Spacer(1, 8),
        paragraph("Your Question", "Section"),
        paragraph(result.get("query", "")),
        paragraph("Answer", "Section"),
        paragraph(result.get("answer", "No answer was generated.")),
        paragraph(f"Answer mode: {result.get('answer_mode', 'unknown')} · Retrieval timestamp: {generated_at}", "Metadata"),
        paragraph(f"Evidence Found ({len(result.get('evidence', []))})", "Section"),
    ]

    evidence_items = result.get("evidence", [])
    if not evidence_items:
        story.append(paragraph("No relevant passages were retrieved. This report contains no passage evidence."))
    for item in evidence_items:
        heading = paragraph(f"{item.get('evidence_id')} · {item.get('passage_id')}", "Section")
        verse = verse_flowables(item.get("passage_text", ""))
        meta = [
            paragraph(f"{item.get('kandam')} · Section {item.get('section_number')}: {item.get('section_name')}", "Metadata"),
            paragraph(f"Source PDF: {item.get('source_pdf') or item.get('source_file')} · Pages {item.get('page_start')}-{item.get('page_end')}", "Metadata"),
            paragraph(f"Retrieval: {', '.join(item.get('retrieval_methods', []))} · Relevance {item.get('relevance_score', 0)} · Final score {item.get('final_score', 0)}", "Metadata"),
        ]
        for provenance in item.get("provenance", []):
            meta.append(paragraph(
                f"Graph provenance: {provenance.get('relationship_id')} · {provenance.get('relationship_type')} · "
                f"{provenance.get('evidence')} · {provenance.get('source_file')} pp. "
                f"{provenance.get('source_page_start')}-{provenance.get('source_page_end')}",
                "Metadata",
            ))
        if len(verse) <= 8:
            # short passage: keep heading, text and its metadata on one page
            story.append(KeepTogether([heading, *verse, Spacer(1, 6), *meta]))
        else:
            # long passage: flows across pages, but the heading stays with the first lines
            # and the metadata stays with the last lines
            story.append(KeepTogether([heading, *verse[:3]]))
            story.extend(verse[3:-2])
            story.append(KeepTogether([*verse[-2:], Spacer(1, 6), *meta]))
        story.append(Spacer(1, 8))

    metadata = result.get("retrieval_metadata", {})
    story.extend([
        paragraph("How the system found this evidence", "Section"),
        paragraph(
            f"Hybrid retrieval uses the configured dense index, BM25 keyword retrieval, and graph context where enabled. "
            f"Graph source: {metadata.get('graph_backend', 'unknown')}. "
            f"Candidate count: {metadata.get('candidate_count', 0)}. "
            f"Index version: {metadata.get('index_version', 'unknown')}.",
            "BodyReadable",
        ),
    ])

    def draw_page(canvas: Any, doc: Any) -> None:
        canvas.saveState()
        canvas.setStrokeColor(colors.HexColor("#d7e3e8"))
        canvas.line(48, 36, A4[0] - 48, 36)
        canvas.setFont(latin_name, 8)
        canvas.setFillColor(colors.HexColor("#62788a"))
        canvas.drawString(48, 23, "Silappatikāram · Evidence-grounded research")
        canvas.drawRightString(A4[0] - 48, 23, f"Page {doc.page}")
        canvas.restoreState()

    document.build(story, onFirstPage=draw_page, onLaterPages=draw_page)
    return buffer.getvalue()


def _report_strings(result: dict[str, Any]) -> list[str]:
    strings = [str(result.get("query", "")), str(result.get("answer", ""))]
    for item in result.get("evidence", []):
        strings.extend(str(item.get(key, "") or "") for key in (
            "passage_text", "kandam", "section_name", "source_file", "source_pdf",
        ))
        for provenance in item.get("provenance", []):
            strings.extend(str(value or "") for value in provenance.values())
    return strings