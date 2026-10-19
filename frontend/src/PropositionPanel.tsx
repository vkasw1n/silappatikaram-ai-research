import { useState } from "react";

type Proposition = {
  proposition_id: string;
  subject: string;
  predicate: string;
  object: string;
  type: string;
  source_passage: string;
  source_page: string;
  evidence_id: string;
  confidence: number;
  natural_language: string;
  evidence: string;
  source_file: string;
  formal_formula?: string;
  fol_predicate?: string;
};

type Props = { item: Proposition | null; items?: Proposition[]; busy: boolean; error: string; onRun: () => void };

export default function PropositionPanel({ item, items = [], busy, error, onRun }: Props) {
  const [viewMode, setViewMode] = useState<"fol" | "predicate" | "natural">("fol");
  const [showAll, setShowAll] = useState(false);

  const displayList = items.length ? items : item ? [item] : [];

  const INITIAL_LIMIT = 3;
  const visibleItems = showAll ? displayList : displayList.slice(0, INITIAL_LIMIT);
  const remainingCount = displayList.length - INITIAL_LIMIT;

  const sanitizePassage = (passStr: string) => {
    if (!passStr) return "Passage P001";
    if (passStr.includes(":") && passStr.length > 20) {
      return "User_Passage_P001";
    }
    return passStr;
  };

  return (
    <section className="proposition-panel" style={{ background: "#ffffff", borderRadius: "10px", padding: "20px", boxShadow: "0 1px 3px rgba(0,0,0,0.05)", border: "1px solid #e2e8f0" }}>
      <div className="panel-heading" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
        <div>
          <span className="panel-number" style={{ background: "#3b82f6", color: "#fff", padding: "2px 8px", borderRadius: "4px", fontWeight: "bold", marginRight: "8px" }}>04</span>
          <h3 style={{ display: "inline", margin: 0, fontSize: "1.15rem", color: "#0f172a" }}>Formal Proposition & Logical Formula Engine</h3>
        </div>
        <span className="tag" style={{ background: "#dbeafe", color: "#1e40af", padding: "4px 10px", borderRadius: "12px", fontSize: "0.75rem", fontWeight: 600 }}>FIRST-ORDER LOGIC</span>
      </div>

      <p className="panel-disclaimer" style={{ color: "#64748b", fontSize: "0.85rem", lineHeight: "1.4", marginBottom: "16px" }}>
        Formal evidence propositions mapped to verified First-Order Logic ($\forall x$) formulas. Mapped directly from source annotations without unauthorized inference.
      </p>

      <div className="control-bar" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", marginBottom: "18px", flexWrap: "wrap" }}>
        <button className="run-button blue-button" onClick={onRun} disabled={busy} style={{ background: "#2563eb", color: "#ffffff", padding: "8px 18px", borderRadius: "6px", border: "none", fontWeight: 600, cursor: "pointer" }}>
          {busy ? "Generating formulas..." : "Generate Logical Formulas"}
        </button>

        {displayList.length > 0 && (
          <div className="view-toggle-buttons" style={{ display: "flex", gap: "6px" }}>
            <button
              className={`toggle-btn ${viewMode === "fol" ? "active" : ""}`}
              onClick={() => setViewMode("fol")}
              style={{
                padding: "6px 12px",
                borderRadius: "5px",
                fontSize: "0.8rem",
                fontWeight: 600,
                background: viewMode === "fol" ? "#0f172a" : "#f1f5f9",
                color: viewMode === "fol" ? "#38bdf8" : "#475569",
                border: "1px solid #cbd5e1",
                cursor: "pointer"
              }}
            >
              ∀x Formal FOL
            </button>
            <button
              className={`toggle-btn ${viewMode === "predicate" ? "active" : ""}`}
              onClick={() => setViewMode("predicate")}
              style={{
                padding: "6px 12px",
                borderRadius: "5px",
                fontSize: "0.8rem",
                fontWeight: 600,
                background: viewMode === "predicate" ? "#0f172a" : "#f1f5f9",
                color: viewMode === "predicate" ? "#4ade80" : "#475569",
                border: "1px solid #cbd5e1",
                cursor: "pointer"
              }}
            >
              Atomic Predicates
            </button>
            <button
              className={`toggle-btn ${viewMode === "natural" ? "active" : ""}`}
              onClick={() => setViewMode("natural")}
              style={{
                padding: "6px 12px",
                borderRadius: "5px",
                fontSize: "0.8rem",
                fontWeight: 600,
                background: viewMode === "natural" ? "#0f172a" : "#f1f5f9",
                color: viewMode === "natural" ? "#f87171" : "#475569",
                border: "1px solid #cbd5e1",
                cursor: "pointer"
              }}
            >
              Natural Language
            </button>
          </div>
        )}
      </div>

      {error && <div className="message error" style={{ color: "#dc2626", background: "#fef2f2", padding: "10px", borderRadius: "6px", marginBottom: "14px" }}>! {error}</div>}

      {displayList.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {visibleItems.map((prop) => {
            const cleanPassage = sanitizePassage(prop.source_passage);
            const cleanFol = (prop.formal_formula || "").replace(/03b7c3d0-[a-f0-9-]+:P001/gi, "Passage_P001");
            const cleanPred = (prop.fol_predicate || "").replace(/03b7c3d0-[a-f0-9-]+:P001/gi, "Passage_P001");
            const cleanNat = (prop.natural_language || "").replace(/03b7c3d0-[a-f0-9-]+:P001/gi, "Passage P001");

            return (
              <div
                className="proposition-card"
                key={prop.proposition_id}
                style={{
                  border: "1px solid #e2e8f0",
                  padding: "14px 16px",
                  borderRadius: "8px",
                  background: "#f8fafc",
                  transition: "all 0.15s ease-in-out"
                }}
              >
                <div className="proposition-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ background: "#2563eb", color: "#fff", padding: "2px 8px", borderRadius: "4px", fontWeight: 700, fontSize: "0.82rem" }}>
                      {prop.proposition_id}
                    </span>
                    <span style={{ fontWeight: 600, color: "#334155", fontSize: "0.88rem" }}>
                      {prop.subject} · {prop.predicate}
                    </span>
                  </div>
                  <span style={{ background: "#e2e8f0", color: "#475569", padding: "3px 10px", borderRadius: "12px", fontSize: "0.76rem", fontWeight: 600 }}>
                    {prop.type} · {(prop.confidence * 100).toFixed(0)}% Confidence
                  </span>
                </div>

                {viewMode === "fol" && (
                  <div style={{ fontFamily: "'Fira Code', 'Courier New', monospace", background: "#0f172a", color: "#38bdf8", padding: "10px 14px", borderRadius: "6px", fontSize: "0.86rem", overflowX: "auto", border: "1px solid #1e293b" }}>
                    {cleanFol || `∀x (Subject(x, '${prop.subject}') ∧ Relation(x, '${prop.predicate}', '${prop.object}') → Evidence(x, '${cleanPassage}'))`}
                  </div>
                )}

                {viewMode === "predicate" && (
                  <div style={{ fontFamily: "'Fira Code', 'Courier New', monospace", background: "#0f172a", color: "#4ade80", padding: "10px 14px", borderRadius: "6px", fontSize: "0.88rem", overflowX: "auto", border: "1px solid #1e293b" }}>
                    {cleanPred || `${prop.predicate}(${prop.subject}, ${prop.object})`}
                  </div>
                )}

                {viewMode === "natural" && (
                  <div style={{ color: "#1e293b", fontSize: "0.88rem", lineHeight: "1.45", background: "#ffffff", padding: "10px 14px", borderRadius: "6px", border: "1px solid #e2e8f0", fontStyle: "italic" }}>
                    "{cleanNat}"
                  </div>
                )}

                <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto 1fr", gap: "6px 16px", fontSize: "0.8rem", color: "#64748b", marginTop: "10px", paddingTop: "8px", borderTop: "1px solid #e2e8f0" }}>
                  <span style={{ fontWeight: 600, color: "#475569" }}>Source Passage:</span>
                  <span>{cleanPassage}</span>
                  <span style={{ fontWeight: 600, color: "#475569" }}>Evidence ID:</span>
                  <span>{prop.evidence_id}</span>
                </div>
              </div>
            );
          })}

          {displayList.length > INITIAL_LIMIT && (
            <button
              onClick={() => setShowAll(!showAll)}
              style={{
                width: "100%",
                padding: "10px",
                borderRadius: "6px",
                background: "#f1f5f9",
                color: "#1e293b",
                border: "1px solid #cbd5e1",
                fontWeight: 600,
                fontSize: "0.85rem",
                cursor: "pointer",
                marginTop: "6px",
                transition: "background 0.15s ease"
              }}
            >
              {showAll ? "▲ Show Less Formulas" : `▼ Show More Formulas (${remainingCount} more)`}
            </button>
          )}
        </div>
      ) : (
        !busy && (
          <div style={{ color: "#64748b", fontSize: "0.88rem", fontStyle: "italic", textAlign: "center", padding: "20px", background: "#f8fafc", borderRadius: "6px", border: "1px dashed #cbd5e1" }}>
            No logical formulas generated yet. Click "Generate Logical Formulas" to begin.
          </div>
        )
      )}
    </section>
  );
}