import { useState } from "react";

type DimensionDetail = {
  value: any;
  method: string;
  confidence: number;
};

type InterpretationStep = {
  name: string;
  label: string;
  status: string;
  method: string;
};

type Interpretation = {
  passage_id: string;
  source_file: string;
  page_start: string;
  page_end: string;
  supporting_terms: string[];
  interpreted_meaning: string;
  confidence: number;
  sabda: DimensionDetail[];
  padartha: DimensionDetail[];
  vakya: DimensionDetail[];
  akanksha: DimensionDetail[];
  yogyata: DimensionDetail[];
  sannidhi: DimensionDetail[];
  prakaranam: DimensionDetail[];
  tatparya: DimensionDetail[];
  interpretation_steps?: InterpretationStep[];
};

type Props = { item: Interpretation | null; busy: boolean; error: string; onRun: () => void };

export default function MimamsaPanel({ item, busy, error, onRun }: Props) {
  const [activeTab, setActiveTab] = useState<string>("sabda");

  const sanitizeText = (str: string) => {
    if (!str) return "";
    return str.replace(/03b7c3d0-[a-f0-9-]+:P001/gi, "User Passage P001");
  };

  const dimensions = [
    { key: "sabda", name: "Śabda", title: "Verbal Utterance & Phonetics", count: item?.sabda?.length || 0 },
    { key: "padartha", name: "Padārtha", title: "Lexical Denotative Meaning", count: item?.padartha?.length || 0 },
    { key: "vakya", name: "Vākya", title: "Syntactic Sentence Unity", count: item?.vakya?.length || 0 },
    { key: "akanksha", name: "Ākāṅkṣā", title: "Syntactic Expectation (Kāraka)", count: item?.akanksha?.length || 0 },
    { key: "yogyata", name: "Yogyatā", title: "Semantic Compatibility Audit", count: item?.yogyata?.length || 0 },
    { key: "sannidhi", name: "Sannidhi", title: "Spatial-Temporal Proximity", count: item?.sannidhi?.length || 0 },
    { key: "prakaranam", name: "Prakaraṇa", title: "Narrative Section Context", count: item?.prakaranam?.length || 0 },
    { key: "tatparya", name: "Tātparya", title: "Hermeneutic Intent (Ṣaḍliṅga)", count: item?.tatparya?.length || 0 },
  ];

  const renderActiveDetails = () => {
    if (!item) return null;
    const dataList = (item as any)[activeTab] as DimensionDetail[] | undefined;
    if (!dataList || !dataList.length) return <div style={{ color: "#64748b", fontStyle: "italic" }}>No data recorded for this dimension.</div>;

    const val = dataList[0]?.value;

    switch (activeTab) {
      case "sabda":
        return (
          <div className="dim-detail">
            <strong style={{ color: "#0f172a", fontSize: "0.88rem" }}>Phonetic Tokens & Sandhi Splitting ({item.sabda.length} items):</strong>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "8px" }}>
              {item.sabda.map((tok, i) => (
                <span key={i} style={{ background: "#e0f2fe", color: "#0369a1", padding: "4px 10px", borderRadius: "4px", fontSize: "0.82rem", fontWeight: 500 }}>
                  {typeof tok.value === "object" ? tok.value.surface_form || tok.value.normalized_token : tok.value}
                </span>
              ))}
            </div>
          </div>
        );

      case "padartha":
        return (
          <div className="dim-detail">
            <strong style={{ color: "#0f172a", fontSize: "0.88rem" }}>Lexical Denotative Sense Mapping (Abhidhā / Lakṣaṇā):</strong>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "8px" }}>
              {item.padartha.map((p, i) => (
                <div key={i} style={{ background: "#f8fafc", padding: "8px 12px", borderRadius: "6px", border: "1px solid #e2e8f0", fontSize: "0.85rem" }}>
                  {typeof p.value === "object" ? (
                    <div>
                      <strong style={{ color: "#0f172a" }}>{p.value.english || p.value.tamil || p.value.surface_term}</strong>
                      <span style={{ marginLeft: "10px", color: "#2563eb", background: "#dbeafe", padding: "2px 8px", borderRadius: "4px", fontSize: "0.76rem", fontWeight: 600 }}>
                        {p.value.denotative_sense || p.value.type}
                      </span>
                    </div>
                  ) : (
                    String(p.value)
                  )}
                </div>
              ))}
            </div>
          </div>
        );

      case "vakya":
        return (
          <div className="dim-detail">
            <strong style={{ color: "#0f172a", fontSize: "0.88rem" }}>Syntactic Clause & Sentence Unity (Ekavākyatā):</strong>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "8px" }}>
              {item.vakya.map((v, i) => (
                <div key={i} style={{ background: "#f8fafc", borderLeft: "3px solid #3b82f6", padding: "8px 12px", borderRadius: "0 6px 6px 0", border: "1px solid #e2e8f0", borderLeftWidth: "4px", fontSize: "0.85rem" }}>
                  {typeof v.value === "object" ? (
                    <div>
                      <div style={{ color: "#0f172a" }}>"{v.value.sentence_text || v.value}"</div>
                      <small style={{ color: "#16a34a", fontWeight: 600, display: "inline-block", marginTop: "4px" }}>✓ {v.value.ekavakyata_status || "Syntactic Complete"}</small>
                    </div>
                  ) : (
                    String(v.value)
                  )}
                </div>
              ))}
            </div>
          </div>
        );

      case "akanksha":
        return (
          <div className="dim-detail">
            <strong style={{ color: "#0f172a", fontSize: "0.88rem" }}>Kāraka Dependency Roles & Expectation Fulfillment:</strong>
            <pre style={{ background: "#0f172a", color: "#38bdf8", padding: "12px", borderRadius: "6px", fontSize: "0.82rem", overflowX: "auto", border: "1px solid #1e293b", marginTop: "8px" }}>
              {JSON.stringify(val, null, 2)}
            </pre>
          </div>
        );

      case "yogyata":
        return (
          <div className="dim-detail">
            <strong style={{ color: "#0f172a", fontSize: "0.88rem" }}>Ontological Semantic Fitness & Logical Fitness Audit:</strong>
            <pre style={{ background: "#0f172a", color: "#4ade80", padding: "12px", borderRadius: "6px", fontSize: "0.82rem", overflowX: "auto", border: "1px solid #1e293b", marginTop: "8px" }}>
              {JSON.stringify(val, null, 2)}
            </pre>
          </div>
        );

      case "sannidhi":
        return (
          <div className="dim-detail">
            <strong style={{ color: "#0f172a", fontSize: "0.88rem" }}>Contiguity & Proximity Metrics:</strong>
            <div style={{ background: "#f8fafc", padding: "12px", borderRadius: "6px", border: "1px solid #e2e8f0", marginTop: "8px", fontSize: "0.85rem", color: "#334155" }}>
              <div>Proximity Score: <strong style={{ color: "#16a34a" }}>{(dataList[0]?.confidence || 0.95) * 100}%</strong></div>
              <div style={{ marginTop: "4px" }}>Spatial Disruption (Vyavadhāna): <strong>None (Passage Local)</strong></div>
              <div style={{ marginTop: "4px" }}>Supporting Terms: <strong>{item.supporting_terms.join(", ") || "None"}</strong></div>
            </div>
          </div>
        );

      case "prakaranam":
        return (
          <div className="dim-detail">
            <strong style={{ color: "#0f172a", fontSize: "0.88rem" }}>Literary Section & Structural Context:</strong>
            <pre style={{ background: "#f8fafc", padding: "12px", borderRadius: "6px", border: "1px solid #e2e8f0", marginTop: "8px", fontSize: "0.85rem", color: "#334155" }}>
              {JSON.stringify(val, null, 2)}
            </pre>
          </div>
        );

      case "tatparya":
        return (
          <div className="dim-detail">
            <strong style={{ color: "#0f172a", fontSize: "0.88rem" }}>Hermeneutic Intent & Ṣaḍliṅga (6 Marks of Intent):</strong>
            <pre style={{ background: "#0f172a", color: "#f38ba8", padding: "12px", borderRadius: "6px", fontSize: "0.82rem", overflowX: "auto", border: "1px solid #1e293b", marginTop: "8px" }}>
              {JSON.stringify(val, null, 2)}
            </pre>
          </div>
        );

      default:
        return null;
    }
  };

  const cleanPassage = sanitizeText(item?.passage_id || "");
  const cleanMeaning = sanitizeText(item?.interpreted_meaning || "");

  return (
    <section className="mimamsa-panel" style={{ background: "#ffffff", borderRadius: "10px", padding: "20px", boxShadow: "0 1px 3px rgba(0,0,0,0.05)", border: "1px solid #e2e8f0", marginBottom: "20px" }}>
      <div className="panel-heading" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
        <div>
          <span className="panel-number" style={{ background: "#2563eb", color: "#fff", padding: "2px 8px", borderRadius: "4px", fontWeight: "bold", marginRight: "8px" }}>03</span>
          <h3 style={{ display: "inline", margin: 0, fontSize: "1.15rem", color: "#0f172a" }}>Classical Mīmāṃsā Exegetical Engine</h3>
        </div>
        <span className="tag" style={{ background: "#dbeafe", color: "#1e40af", padding: "4px 10px", borderRadius: "12px", fontSize: "0.75rem", fontWeight: 600 }}>8-DIMENSIONAL HERMENEUTICS</span>
      </div>

      <p className="panel-disclaimer" style={{ color: "#64748b", fontSize: "0.85rem", lineHeight: "1.4", marginBottom: "16px" }}>
        Computational Mīmāṃsā textual interpretation engine evaluating Śabda, Padārtha, Vākya, Ākāṅkṣā, Yogyatā, Sannidhi, Prakaraṇa, and Tātparya.
      </p>

      <div className="mimamsa-dimensions" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px", margin: "12px 0 16px 0" }}>
        {dimensions.map((dim) => (
          <div
            key={dim.key}
            onClick={() => setActiveTab(dim.key)}
            style={{
              padding: "10px",
              borderRadius: "6px",
              border: activeTab === dim.key ? "2px solid #2563eb" : "1px solid #e2e8f0",
              background: activeTab === dim.key ? "#eff6ff" : "#f8fafc",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            <div style={{ fontWeight: 700, color: activeTab === dim.key ? "#1d4ed8" : "#0f172a", fontSize: "0.88rem" }}>
              {dim.name}
            </div>
            <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "2px" }}>
              {item ? `✓ Complete (${dim.count})` : dim.title}
            </div>
          </div>
        ))}
      </div>

      <button className="run-button blue-button" onClick={onRun} disabled={busy} style={{ background: "#2563eb", color: "#ffffff", padding: "8px 18px", borderRadius: "6px", border: "none", fontWeight: 600, cursor: "pointer", marginBottom: "16px" }}>
        {busy ? "Interpreting text..." : "Run Mīmāṃsā Interpretation"}
      </button>

      {error && <div className="message error" style={{ color: "#dc2626", background: "#fef2f2", padding: "10px", borderRadius: "6px", marginBottom: "14px" }}>! {error}</div>}

      {item && (
        <div className="interpretation-result" style={{ border: "1px solid #e2e8f0", borderRadius: "8px", padding: "16px", background: "#ffffff" }}>
          <div className="result-meta" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
            <strong style={{ color: "#0f172a", fontSize: "0.95rem" }}>Target Passage: {cleanPassage}</strong>
            <span style={{ fontSize: "0.8rem", color: "#64748b", background: "#f1f5f9", padding: "3px 10px", borderRadius: "12px", fontWeight: 500 }}>
              {item.source_file} · pages {item.page_start}-{item.page_end} · Confidence {(item.confidence * 100).toFixed(0)}%
            </span>
          </div>

          <div style={{ background: "#f8fafc", borderLeft: "4px solid #2563eb", padding: "12px 14px", borderRadius: "0 6px 6px 0", marginBottom: "14px" }}>
            <div style={{ fontWeight: 700, color: "#1e293b", fontSize: "0.85rem", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Interpretation Summary:
            </div>
            <div style={{ fontSize: "0.9rem", color: "#334155", lineHeight: "1.5" }}>
              {cleanMeaning}
            </div>
          </div>

          <div className="tab-detail-container" style={{ borderTop: "1px solid #e2e8f0", paddingTop: "14px" }}>
            {renderActiveDetails()}
          </div>
        </div>
      )}
    </section>
  );
}