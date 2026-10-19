import re
import time
from typing import Any, Optional

try:
    from ..domain.proposition_schema import PropositionSchema
except ImportError:
    from domain.proposition_schema import PropositionSchema

try:
    from .corpus_service import TEXT_CORPORA
    from .preprocessing_service import (
        REQUIRED_ENTITY_COLUMNS,
        REQUIRED_PASSAGE_COLUMNS,
        _dataset_path,
        _read_csv,
    )
except ImportError:
    from application.corpus_service import TEXT_CORPORA
    from application.preprocessing_service import (
        REQUIRED_ENTITY_COLUMNS,
        REQUIRED_PASSAGE_COLUMNS,
        _dataset_path,
        _read_csv,
    )

RELATIONSHIP_COLUMNS = {
    "relationship_id", "source_id", "source_type", "relationship_type",
    "target_id", "target_type", "passage_id", "event_id", "evidence",
    "confidence", "source_file", "source_page_start", "source_page_end",
}
EVENT_COLUMNS = {
    "event_id", "passage_id", "kandam", "section_number", "section_name",
    "event_type", "event_name_tamil", "event_name_english", "participants",
    "location", "temporal_info", "event_description", "source_file",
    "source_page_start", "source_page_end", "confidence",
}
PROPOSITION_VERSION = "module-4-annotated-evidence-2.0"


def _confidence(value: str) -> float:
    try:
        return max(0.0, min(1.0, float(value)))
    except (TypeError, ValueError):
        return {"high": 0.9, "medium": 0.7, "low": 0.4}.get(str(value).lower(), 0.5)


def _display(node_id: str, node_type: str, nodes: dict[tuple[str, str], str]) -> str:
    return nodes.get((node_type, node_id), node_id)


def _load_proposition_inputs() -> tuple[list[dict[str, str]], dict[tuple[str, str], str]]:
    entities = _read_csv(_dataset_path("entities.csv"), REQUIRED_ENTITY_COLUMNS)
    passages = _read_csv(_dataset_path("passages.csv"), REQUIRED_PASSAGE_COLUMNS)
    events = _read_csv(_dataset_path("events.csv"), EVENT_COLUMNS)
    relationships = _read_csv(_dataset_path("relationships.csv"), RELATIONSHIP_COLUMNS)
    nodes: dict[tuple[str, str], str] = {}
    for row in entities:
        nodes[("ENTITY", row["entity_id"])] = row["entity_name_english"] or row["entity_name_tamil"]
    for row in passages:
        nodes[("PASSAGE", row["passage_id"])] = row["passage_id"]
    for row in events:
        nodes[("EVENT", row["event_id"])] = row["event_name_english"] or row["event_name_tamil"]
    valid_ids = {(node_type, node_id) for node_type, node_id in nodes}
    valid_relationships = [
        row for row in relationships
        if (row["source_type"], row["source_id"]) in valid_ids
        and (row["target_type"], row["target_id"]) in valid_ids
        and row["relationship_id"]
        and row["passage_id"]
        and row["evidence"]
    ]
    return valid_relationships, nodes


def _sanitize_ident(name: str) -> str:
    cleaned = re.sub(r"[^\w]", "_", name)
    cleaned = re.sub(r"_+", "_", cleaned).strip("_")
    return cleaned or "Entity"


def generate_propositions(passage_id: Optional[str] = None, include_custom: bool = False) -> dict[str, Any]:
    started = time.perf_counter()
    relationships, nodes = _load_proposition_inputs()
    propositions: list[dict[str, Any]] = []

    # Handle user-entered custom corpus text (ends with :P001)
    if passage_id and passage_id.endswith(":P001"):
        if not include_custom:
            return {
                "processing_version": PROPOSITION_VERSION,
                "method": "validated relationships.csv annotations only",
                "proposition_count": 0,
                "processing_time_ms": round((time.perf_counter() - started) * 1000, 2),
                "propositions": [],
                "safety": {
                    "generated_facts": 0,
                    "generated_inferences": 0,
                    "generated_assumptions": 0,
                    "nyaya_reasoning": "not implemented",
                },
            }
        corpus_id = passage_id[:-5]
        corpus_data = TEXT_CORPORA.get(corpus_id)
        raw_text = corpus_data["text"] if corpus_data else "User text input"
        source_file = corpus_data["filename"] if corpus_data else "entered_corpus.txt"

        # Split into sentences or key clauses
        sentences = [s.strip() for s in re.split(r"[.!?\n]+", raw_text) if s.strip()]
        if not sentences:
            sentences = [raw_text]

        # Deduplicate entities by name
        all_entities = _read_csv(_dataset_path("entities.csv"), REQUIRED_ENTITY_COLUMNS)
        seen_entities = set()
        unique_entities = []
        for ent in all_entities:
            name_t = ent.get("entity_name_tamil", "")
            name_e = ent.get("entity_name_english", "")
            key = name_e or name_t
            if key and key not in seen_entities:
                if (name_t and name_t in raw_text) or (name_e and name_e.lower() in raw_text.lower()):
                    seen_entities.add(key)
                    unique_entities.append(ent)

        idx = 1
        clean_passage = "Passage_P001"

        # 1. Base passage proposition
        p_base = PropositionSchema(
            proposition_id=f"P{idx}",
            subject="EnteredTextCorpus",
            predicate="CONTAINS_PASSAGE",
            object=clean_passage,
            type="EVIDENCE",
            source_passage=clean_passage,
            source_page="1",
            evidence_id=f"EV_USER_{idx}",
            confidence=1.0,
            natural_language=f"The entered corpus '{source_file}' contains user passage '{clean_passage}'.",
            evidence=raw_text[:200] + ("..." if len(raw_text) > 200 else ""),
            source_file=source_file,
            fol_predicate=f"CONTAINS_PASSAGE(EnteredTextCorpus, {clean_passage})",
            formal_formula=f"∀x (CorpusText(x) → Passage({clean_passage}))",
        )
        propositions.append(p_base.dict())
        idx += 1

        # 2. Entity propositions found in custom text (unique entities only)
        for ent in unique_entities[:6]:
            ent_name = ent.get("entity_name_english") or ent.get("entity_name_tamil")
            ent_id = ent.get("entity_id")
            s_ident = _sanitize_ident(ent_name)
            p_ent = PropositionSchema(
                proposition_id=f"P{idx}",
                subject=ent_name,
                predicate="MENTIONED_IN",
                object=clean_passage,
                type="EVIDENCE",
                source_passage=clean_passage,
                source_page="1",
                evidence_id=f"EV_USER_ENT_{ent_id}",
                confidence=0.9,
                natural_language=f"Entity '{ent_name}' is explicitly mentioned in user passage '{clean_passage}'.",
                evidence=f"Matched entity surface form '{ent_name}' in custom text.",
                source_file=source_file,
                fol_predicate=f"MENTIONED_IN({s_ident}, {clean_passage})",
                formal_formula=f"∀x (Entity('{s_ident}') ∧ InPassage(x, '{clean_passage}') → EvidenceMention(x))",
            )
            propositions.append(p_ent.dict())
            idx += 1

        # 3. Sentence propositions
        for i, sentence in enumerate(sentences[:4], start=1):
            s_short = sentence[:60] + ("..." if len(sentence) > 60 else "")
            p_sent = PropositionSchema(
                proposition_id=f"P{idx}",
                subject=f"Sentence_{i}",
                predicate="ASSERTS_CLAIM",
                object=clean_passage,
                type="EVIDENCE",
                source_passage=clean_passage,
                source_page="1",
                evidence_id=f"EV_USER_SENT_{i}",
                confidence=0.85,
                natural_language=f"Sentence {i} ('{s_short}') is recorded as text evidence for passage {clean_passage}.",
                evidence=sentence,
                source_file=source_file,
                fol_predicate=f"ASSERTS_CLAIM(Sentence_{i}, {clean_passage})",
                formal_formula=f"∀s (Sentence(s, '{i}') ∧ InPassage(s, '{clean_passage}') → FormalEvidence(s))",
            )
            propositions.append(p_sent.dict())
            idx += 1

    else:
        # Standard passage matching from dataset
        selected = [row for row in relationships if passage_id is None or row["passage_id"] == passage_id]

        for index, row in enumerate(selected, start=1):
            subject = _display(row["source_id"], row["source_type"], nodes)
            target = _display(row["target_id"], row["target_type"], nodes)
            predicate = row["relationship_type"]
            source_page = f"{row['source_page_start']}-{row['source_page_end']}"

            s_subj = _sanitize_ident(subject)
            s_pred = _sanitize_ident(predicate).upper()
            s_targ = _sanitize_ident(target)

            fol_pred = f"{s_pred}({s_subj}, {s_targ})"
            formal_form = f"∀x (Subject(x, '{s_subj}') ∧ Relation(x, '{s_pred}', '{s_targ}') → Evidence(x, '{row['passage_id']}'))"

            proposition = PropositionSchema(
                proposition_id=f"P{index}",
                subject=subject,
                predicate=predicate,
                object=target,
                type="EVIDENCE",
                source_passage=row["passage_id"],
                source_page=source_page,
                evidence_id=row["relationship_id"],
                confidence=_confidence(row["confidence"]),
                natural_language=(
                    f"The prepared annotation records {subject} as {predicate} {target}; "
                    "this is evidence metadata, not an independently established fact."
                ),
                evidence=row["evidence"],
                source_file=row["source_file"],
                fol_predicate=fol_pred,
                formal_formula=formal_form,
            )
            propositions.append(proposition.dict())

    return {
        "processing_version": PROPOSITION_VERSION,
        "method": "validated formal propositions with First-Order Logic formulas",
        "proposition_count": len(propositions),
        "processing_time_ms": round((time.perf_counter() - started) * 1000, 2),
        "propositions": propositions,
        "safety": {
            "generated_facts": 0,
            "generated_inferences": 0,
            "generated_assumptions": 0,
            "nyaya_reasoning": "not implemented",
        },
    }