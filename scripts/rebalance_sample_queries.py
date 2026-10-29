import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SAMPLE_PATH = ROOT / "data" / "silappatikaram_sample_queries_1000.txt"
TAMIL_RE = re.compile(r"[\u0B80-\u0BFF]")

ENGLISH_TEMPLATES = [
    "What evidence is recorded for passage {number} in the indexed corpus?",
    "Which source passage supports the event described in passage {number}?",
    "What entities are connected with passage {number} in the knowledge graph?",
    "Which graph relationships are linked to passage {number}?",
    "What relationship path connects Kovalan with the anklet in the graph?",
    "Which graph entities are connected with Kovalan in the indexed corpus?",
    "How is Kovalan related to the anklet according to graph evidence?",
    "Find the graph path for Kovalan and explain its recorded provenance.",
    "Which passage records the evidence about Kovalan's execution?",
    "What does the corpus establish about Kannaki and the anklet?",
    "Which source pages support the answer about Kovalan's execution?",
    "Summarise the indexed evidence without adding unsupported details.",
    "What passage and page range support this literary event?",
    "Which entities and events are associated with this passage?",
    "How does the knowledge graph represent this relationship?",
    "What textual evidence is available for this question?",
    "Can the corpus verify this claim using recorded evidence only?",
    "Which source passage should be cited for this question?",
    "What evidence is available when the query is searched by graph context?",
    "Show the provenance for the retrieved literary evidence.",
]


def main() -> None:
    lines = [line.strip() for line in SAMPLE_PATH.read_text(encoding="utf-8").splitlines() if line.strip()]
    english = [line for line in lines if not TAMIL_RE.search(line)]
    tamil = [line for line in lines if TAMIL_RE.search(line)]

    if len(lines) != 1000:
        raise ValueError(f"Expected 1000 sample queries, found {len(lines)}")
    if len(english) > 500 or len(tamil) < 500:
        raise ValueError(f"Cannot rebalance safely: English={len(english)}, Tamil={len(tamil)}")

    additions_needed = 500 - len(english)
    additions = [
        template.format(number=index + 1)
        for index in range(additions_needed)
        for template in [ENGLISH_TEMPLATES[index % len(ENGLISH_TEMPLATES)]]
    ]
    balanced = english[:500] + additions + tamil[:500]
    if len(balanced) != 1000:
        raise AssertionError(f"Balanced dataset has {len(balanced)} records")

    SAMPLE_PATH.write_text("\n".join(balanced) + "\n", encoding="utf-8")
    print(f"Wrote {len(balanced)} queries: {len(english[:500]) + len(additions)} English, {len(tamil[:500])} Tamil")


if __name__ == "__main__":
    main()