type RecordValue = Record<string, any>;
import { translate, type Language } from "./i18n";

type Props = {
  item: RecordValue | null;
  busy: boolean;
  canRun: boolean;
  error: string;
  onRun: () => void;
  onBack: () => void;
  language: Language;
};

const DIMENSIONS = [
  { key: "sabda", name: "Śabda", description: "Lists the first 15 whitespace-separated surface forms from the passage." },
  { key: "padartha", name: "Padārtha", description: "Lists linked entities, or sample terms when no entity is linked." },
  { key: "vakya", name: "Vākya", description: "Splits the passage into sentences and records each sentence's token count." },
  { key: "akanksha", name: "Ākāṅkṣā", description: "Assigns heuristic participant roles from known entity categories." },
  { key: "yogyata", name: "Yogyatā", description: "Records rule-based semantic compatibility labels for matched entities." },
  { key: "sannidhi", name: "Sannidhi", description: "Records passage-local sentence, token, and contiguity information." },
  { key: "prakaranam", name: "Prakaraṇa", description: "Connects the passage to its Kāṇṭam and section metadata." },
  { key: "tatparya", name: "Tātparya", description: "Records six intent labels and a heuristic sentence typology." },
];

function readableKey(key: string) {
  return key.replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function InterpretationValue({ value }: { value: any }) {
  if (Array.isArray(value)) {
    return <ul className="meaning-value-list">{value.map((entry, entryIndex) => <li key={entryIndex}><InterpretationValue value={entry} /></li>)}</ul>;
  }
  if (value && typeof value === "object") {
    return <dl className="meaning-value-grid">{Object.entries(value).map(([key, entry]) => <div key={key}><dt>{readableKey(key)}</dt><dd><InterpretationValue value={entry} /></dd></div>)}</dl>;
  }
  if (typeof value === "boolean") return <span>{value ? "Yes" : "No"}</span>;
  return <span>{value == null ? "Not recorded" : String(value)}</span>;
}

function recordConfidence(record: RecordValue) {
  return typeof record.confidence === "number" ? `${Math.round(record.confidence * 100)}%` : "Not recorded";
}

export default function MimamsaPage({ item, busy, canRun, error, onRun, onBack, language }: Props) {
  const t = (key: string) => translate(language, key);
  return <main className="main-content mimamsa-detail-page">
    <header className="topbar detail-topbar">
      <div><p className="eyebrow">Module 03 · Passage analysis</p><h1>Mīmāṃsā Interpretation Details</h1></div>
      <button className="secondary-button" onClick={onBack}>← {t("home")}</button>
    </header>

    {!item ? <section className="meaning-empty">
      <span className="eyebrow">No interpretation yet</span>
      <h2>Run the interpretation stage to view its records.</h2>
      <p>{canRun ? "The selected passage is ready for analysis." : "Complete Input and Preprocessing first."}</p>
      {error && <p className="error-message">{error}</p>}
      <button className="primary-button" disabled={!canRun || busy} onClick={onRun}>{busy ? "Interpreting passage…" : "Run Interpretation"}</button>
    </section> : <article className="meaning-page-result">
      <div className="meaning-result-heading">
        <div><span className="eyebrow">Passage analyzed</span><h2>{item.passage_id}</h2></div>
        <div className="source-citation">{item.source_file}<br />Pages {item.page_start}-{item.page_end}</div>
      </div>
      <p className="meaning-overview">Explore the values recorded for each interpretive dimension. Expand a section to see its passage-specific data and processing metadata.</p>
      <p className="meaning-limit">These are source-linked, heuristic records; they are not formal linguistic parsing or proof.</p>

      <div className="meaning-dimensions">
        {DIMENSIONS.map((dimension, dimensionIndex) => {
          const records: RecordValue[] = item[dimension.key] || [];
          return <details className="meaning-dimension" key={dimension.key} open={dimensionIndex === 0}>
            <summary>
              <span className="meaning-index">{String(dimensionIndex + 1).padStart(2, "0")}</span>
              <span className="meaning-dimension-copy"><b>{dimension.name}</b><small>{dimension.description}</small></span>
              <span className="meaning-count">{records.length} {records.length === 1 ? "record" : "records"}</span>
            </summary>
            <div className="meaning-data">
              {!records.length ? <p>No data was recorded for this dimension.</p> : <>
                {dimension.key === "sabda"
                  ? <div className="meaning-token-list">{records.map((record, recordIndex) => <span key={recordIndex}>{record.value?.surface_form || record.value}</span>)}</div>
                  : <InterpretationValue value={records.map((record) => record.value)} />}
                <div className="meaning-record-meta">
                  <span>{records[0].method || "Processing method not recorded"}</span>
                  <span>Recorded confidence: {recordConfidence(records[0])}</span>
                </div>
              </>}
            </div>
          </details>;
        })}
      </div>
    </article>}
  </main>;
}
