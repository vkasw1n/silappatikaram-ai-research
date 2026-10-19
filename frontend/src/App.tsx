import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import "./styles.css";
import KnowledgeGraphPage from "./KnowledgeGraphPage";
import MimamsaPage from "./MimamsaPage";
import SampleQueryPicker from "./SampleQueryPicker";
import { saveLanguage, storedLanguage, translate, type Language } from "./i18n";

type RecordValue = Record<string, any>;
type Corpus = { corpus_id: string; filename: string; file_size: number; status: string; context_text?: string };
type GraphData = { nodes: RecordValue[]; relationships: RecordValue[]; backend: string };
type StageState = "idle" | "running" | "complete" | "error";
type Severity = "Ready" | "Information" | "Warning" | "Error";

class ApiError extends Error {
  technical: string;
  network: boolean;

  constructor(message: string, technical: string, network = false) {
    super(message);
    this.technical = technical;
    this.network = network;
  }
}

const API = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
const TITLES = ["input", "preprocessing", "meaning", "logicalRepresentation", "knowledgeGraph", "evidenceRetrieval", "answer"];

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const isReadRequest = !options?.method || options.method.toUpperCase() === "GET";
  let response: Response | undefined;
  for (let attempt = 0; attempt < (isReadRequest ? 4 : 1); attempt += 1) {
    try {
      response = await fetch(`${API}${path}`, options);
      break;
    } catch {
      if (attempt === (isReadRequest ? 3 : 0)) {
        throw new ApiError("The service could not be reached.", "Network request failed for the local API.", true);
      }
      await new Promise((resolve) => window.setTimeout(resolve, 500 * (attempt + 1)));
    }
  }
  if (!response) throw new ApiError("The service could not be reached.", "Network request failed for the local API.", true);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const technical = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail || body);
    const message = response.status >= 500
      ? "The service could not complete this step."
      : "The request was not accepted. Check the selected input and previous stage.";
    throw new ApiError(message, technical);
  }
  return body as T;
}

function Panel({ number, title, children, id }: { number: string; title: string; children: ReactNode; id: string }) {
  return <section className="panel" id={id}>
    <div className="panel-title"><span className="panel-number">{number}</span><h2>{title}</h2></div>
    {children}
  </section>;
}

function setStageState(setter: React.Dispatch<React.SetStateAction<StageState[]>>, index: number, state: StageState) {
  setter((current) => current.map((item, position) => position === index ? state : item));
}

function revealStage(id: string) {
  window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
    const stage = document.getElementById(id);
    if (!stage) return;
    stage.scrollIntoView({ block: "start", behavior: "instant" });
  }));
}

export default function App() {
  const [language, setLanguage] = useState<Language>(storedLanguage);
  const [activeView, setActiveView] = useState<"workflow" | "graph" | "mimamsa">("workflow");
  const [sourceMode, setSourceMode] = useState<"prepared" | "custom">("prepared");
  const [sourceText, setSourceText] = useState("");
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [question, setQuestion] = useState("");
  const [corpus, setCorpus] = useState<Corpus | null>(null);
  const [states, setStates] = useState<StageState[]>(Array(7).fill("idle"));
  const [busyStage, setBusyStage] = useState<number | "pipeline" | "pdf" | null>(null);
  const [failedStage, setFailedStage] = useState<number | null>(null);
  const [errors, setErrors] = useState<Record<number, string>>({});
  const [technicalErrors, setTechnicalErrors] = useState<Record<number, string>>({});
  const [failureSuggestions, setFailureSuggestions] = useState<Record<number, string>>({});
  const [preprocessing, setPreprocessing] = useState<RecordValue | null>(null);
  const [interpretation, setInterpretation] = useState<RecordValue | null>(null);
  const [propositions, setPropositions] = useState<RecordValue[]>([]);
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [rag, setRag] = useState<RecordValue | null>(null);
  const [pdfError, setPdfError] = useState("");
  const [pdfTechnical, setPdfTechnical] = useState("");
  const [pdfDownloaded, setPdfDownloaded] = useState(false);
  const [showAllEvidence, setShowAllEvidence] = useState(false);
  const [expandedPassages, setExpandedPassages] = useState<string[]>([]);
  const [sourceDetails, setSourceDetails] = useState<RecordValue | null>(null);
  const [sourceBusy, setSourceBusy] = useState(false);
  const [sourceError, setSourceError] = useState("");
  const t = (key: string) => translate(language, key);
  const changeLanguage = (next: Language) => {
    setLanguage(next);
    saveLanguage(next);
  };
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const clearDownstream = (from = 0) => {
    setStates((current) => current.map((state, index) => index >= from ? "idle" : state));
    setErrors((current) => Object.fromEntries(Object.entries(current).filter(([index]) => Number(index) < from)));
    setTechnicalErrors((current) => Object.fromEntries(Object.entries(current).filter(([index]) => Number(index) < from)));
    setFailureSuggestions((current) => Object.fromEntries(Object.entries(current).filter(([index]) => Number(index) < from)));
    if (from <= 1) setPreprocessing(null);
    if (from <= 2) setInterpretation(null);
    if (from <= 3) setPropositions([]);
    if (from <= 4) setGraphData(null);
    if (from <= 5) {
      setRag(null);
      setShowAllEvidence(false);
      setExpandedPassages([]);
    }
    setFailedStage(null);
  };

  const resetForInputChange = () => {
    setCorpus(null);
    clearDownstream(0);
  };

  const runInput = async (): Promise<Corpus> => {
    let result: Corpus;
    if (sourceMode === "prepared") {
      result = await api<Corpus>("/api/corpus/upload", {
        method: "POST",
        body: new URLSearchParams({ use_prepared: "true" }),
      });
    } else if (sourceFile) {
      const body = new FormData();
      body.append("file", sourceFile);
      result = await api<Corpus>("/api/corpus/upload", { method: "POST", body });
    } else {
      if (!sourceText.trim()) throw new Error("Choose the prepared corpus, enter text, or upload a file first.");
      result = await api<Corpus>("/api/corpus/text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: sourceText, filename: "entered_corpus.txt" }),
      });
    }
    setCorpus(result);
    return result;
  };

  const runPreprocessing = async (selectedCorpus: Corpus) => {
    const suffix = selectedCorpus.status === "prepared_selected" ? "" : `?corpus_id=${encodeURIComponent(selectedCorpus.corpus_id)}`;
    const result = await api<RecordValue>(`/api/preprocessing/run${suffix}`, { method: "POST" });
    setPreprocessing(result);
  };

  const runMeaning = async (selectedCorpus: Corpus) => {
    const custom = selectedCorpus.status !== "prepared_selected";
    const passage = custom ? `?passage_id=${encodeURIComponent(`${selectedCorpus.corpus_id}:P001`)}` : "";
    const result = await api<RecordValue>(`/api/interpretation/run${passage}`, { method: "POST" });
    if (!result.interpretations?.length) throw new Error("No interpretation was returned for this input.");
    setInterpretation(result.interpretations[0]);
  };

  const runLogical = async (selectedCorpus: Corpus) => {
    const custom = selectedCorpus.status !== "prepared_selected";
    const params = new URLSearchParams({ include_custom: "true" });
    if (custom) params.set("passage_id", `${selectedCorpus.corpus_id}:P001`);
    const result = await api<RecordValue>(`/api/propositions/generate?${params}`, { method: "POST" });
    setPropositions(result.propositions || []);
  };

  const runGraph = async (query: string, context = "") => {
    if (!query.trim()) throw new Error("Enter a question before building its graph context.");
    const graphQuery = `${query}\n${(context || "").slice(0, 350)}`.slice(0, 500);
    const result = await api<GraphData>(`/api/graph/search?q=${encodeURIComponent(graphQuery)}&hops=1`);
    setGraphData(result);
  };

  const runEvidence = async (query: string, context = "") => {
    if (!query.trim()) throw new Error("Enter a question before finding evidence.");
    const result = await api<RecordValue>("/api/rag/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, context, top_k: 12, use_dense: true, use_bm25: true, use_graph: true, use_reranker: true }),
    });
    setRag(result);
    setShowAllEvidence(false);
    setExpandedPassages([]);
  };

  const viewSource = async (passageId: string) => {
    setSourceBusy(true);
    setSourceError("");
    try {
      setSourceDetails(await api<RecordValue>(`/api/corpus/passages/${encodeURIComponent(passageId)}`));
    } catch {
      setSourceError("The source passage could not be loaded. Try the source citation shown on the evidence item.");
    } finally {
      setSourceBusy(false);
    }
  };

  const runStage = async (index: number) => {
    if (busyStage !== null) return;
    if (index > 0 && states[index - 1] !== "complete") return;
    if ((index === 4 || index === 5) && !question.trim()) {
      setErrors((current) => ({ ...current, [index]: "Enter a question before running this stage." }));
      return;
    }

    clearDownstream(index + 1);
    if (index === 5) setRag(null);
    setBusyStage(index);
    setFailedStage(null);
    setErrors((current) => ({ ...current, [index]: "" }));
    setStageState(setStates, index, "running");
    try {
      let selectedCorpus = corpus;
      if (index === 0) selectedCorpus = await runInput();
      if (index === 1 && selectedCorpus) await runPreprocessing(selectedCorpus);
      if (index === 2 && selectedCorpus) await runMeaning(selectedCorpus);
      if (index === 3 && selectedCorpus) await runLogical(selectedCorpus);
      if (index === 4) await runGraph(question, corpus?.context_text);
      if (index === 5) {
        await runEvidence(question, corpus?.context_text);
        setStageState(setStates, 6, "complete");
        revealStage("stage-rag");
      }
      setStageState(setStates, index, "complete");
    } catch (error) {
      const failure = getStageFailure(index, error);
      setErrors((current) => ({ ...current, [index]: failure.message }));
      setTechnicalErrors((current) => ({ ...current, [index]: failure.technical }));
      setFailureSuggestions((current) => ({ ...current, [index]: failure.suggestion }));
      setStageState(setStates, index, "error");
      if (index === 5) setStageState(setStates, 6, "error");
      setFailedStage(index);
    } finally {
      setBusyStage(null);
    }
  };

  const runCompletePipeline = async () => {
    if (busyStage !== null) return;
    if (!question.trim()) {
      setErrors((current) => ({ ...current, 5: "Enter the exact question you want the evidence search to answer." }));
      document.getElementById("stage-input")?.scrollIntoView({ behavior: "smooth" });
      return;
    }
    setBusyStage("pipeline");
    setFailedStage(null);
    setErrors({});
    setTechnicalErrors({});
    setFailureSuggestions({});
    setStates(Array(7).fill("idle"));
    setPreprocessing(null);
    setInterpretation(null);
    setPropositions([]);
    setGraphData(null);
    setRag(null);

    let selectedCorpus: Corpus | null = null;
    const actions: Array<() => Promise<unknown>> = [
      async () => { selectedCorpus = await runInput(); },
      async () => { if (!selectedCorpus) throw new Error("Input must complete first."); await runPreprocessing(selectedCorpus); },
      async () => { if (!selectedCorpus) throw new Error("Input must complete first."); await runMeaning(selectedCorpus); },
      async () => { if (!selectedCorpus) throw new Error("Input must complete first."); await runLogical(selectedCorpus); },
      async () => runGraph(question, selectedCorpus?.context_text),
      async () => runEvidence(question, selectedCorpus?.context_text),
    ];

    let pipelineFailed = false;
    for (let index = 0; index < actions.length; index += 1) {
      setStageState(setStates, index, "running");
      if (index === 5) setStageState(setStates, 6, "running");
      try {
        await actions[index]();
        setStageState(setStates, index, "complete");
        if (index === 5) setStageState(setStates, 6, "complete");
      } catch (error) {
        pipelineFailed = true;
        const failure = getStageFailure(index, error);
        setErrors((current) => ({ ...current, [index]: failure.message }));
        setTechnicalErrors((current) => ({ ...current, [index]: failure.technical }));
        setFailureSuggestions((current) => ({ ...current, [index]: failure.suggestion }));
        setStageState(setStates, index, "error");
        if (index === 5) setStageState(setStates, 6, "error");
        setFailedStage(index);
        break;
      }
    }
    if (!pipelineFailed) {
      revealStage("stage-rag");
    }
    setBusyStage(null);
  };

  const downloadEvidence = async () => {
    if (!rag || !question.trim()) return;
    setBusyStage("pdf");
    setPdfError("");
    setPdfTechnical("");
    setPdfDownloaded(false);
    try {
      const response = await fetch(`${API}/api/rag/evidence.pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: question, context: corpus?.context_text || "", top_k: 12, use_dense: true, use_bm25: true, use_graph: true, use_reranker: true }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        const rawDetail = typeof body.detail === "string" ? body.detail : "PDF export endpoint returned an error";
        setPdfTechnical(rawDetail);
        if (response.status === 503) throw new Error("The report needs a Tamil Unicode font. Check the PDF font configuration.");
        throw new Error("The evidence report could not be generated. Check the query and try again.");
      }
      const file = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = file;
      link.download = "silappatikaram-evidence.pdf";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(file), 1000);
      setPdfDownloaded(true);
    } catch (error) {
      setPdfError(error instanceof ApiError ? error.message : "The PDF could not be prepared. Check the Tamil Unicode font configuration and retry.");
      if (!pdfTechnical && error instanceof ApiError) setPdfTechnical(error.technical);
    } finally {
      setBusyStage(null);
    }
  };

  const navigate = (destination: string) => {
    if (destination === "mimamsa") {
      setActiveView("mimamsa");
      window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
      return;
    }
    if (destination === "graph") {
      setActiveView("graph");
      window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
      return;
    }
    setActiveView("workflow");
    if (destination === "workflow") {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    revealStage(destination);
  };

  if (activeView === "mimamsa") {
    return <div className="app-shell">
      <Sidebar active="stage-meaning" onNavigate={navigate} language={language} onLanguageChange={changeLanguage} />
      <MimamsaPage item={interpretation} busy={busyStage === 2} canRun={states[1] === "complete"} error={errors[2] || ""} onRun={() => void runStage(2)} onBack={() => setActiveView("workflow")} language={language} />
    </div>;
  }

  if (activeView === "graph") {
    return <div className="app-shell graph-shell">
      <Sidebar active="graph" onNavigate={navigate} language={language} onLanguageChange={changeLanguage} />
      <KnowledgeGraphPage initialQuery={question} initialContext={corpus?.context_text || ""} api={api} onBack={() => setActiveView("workflow")} language={language} />
    </div>;
  }

  const evidence: RecordValue[] = rag?.evidence || [];
  const sourceNames = [...new Set(evidence.map((item) => item.source_pdf || item.source_file).filter(Boolean))];
  const insufficientEvidence = rag?.status === "INSUFFICIENT_EVIDENCE" || evidence.length === 0;
  const answerState = insufficientEvidence ? "insufficient" : rag?.answer_mode === "llm" ? "generated" : "fallback";
  const visibleEvidence = showAllEvidence ? evidence : evidence.slice(0, 3);
  const stageButton = (index: number, label: string, prerequisite: boolean) => (
    <button className="action-button" disabled={busyStage !== null || !prerequisite} onClick={() => void runStage(index)}>
      {busyStage === index ? "Working…" : states[index] === "error" ? `Retry ${label}` : states[index] === "complete" ? `${label} again` : label}
    </button>
  );

  return <div className="app-shell">
    <Sidebar active="workflow" onNavigate={navigate} language={language} onLanguageChange={changeLanguage} />
    <main className="main-content">
      <header className="topbar">
        <div><p className="eyebrow">Tamil classical literature</p><h1>Silappatikāram Using Mīmāṃsā-Based Interpretation, Knowledge Graphs, and Hybrid RAG</h1></div>
        <button className="primary-button pipeline-button" disabled={busyStage !== null} onClick={() => void runCompletePipeline()}>
          {busyStage === "pipeline" ? t("working") : failedStage !== null ? `${t("runComplete")} · Retry` : t("runComplete")}
        </button>
      </header>

      <section className="intro">
        <div><span className="eyebrow">A source-grounded reading workflow</span><h2>From literary question to cited evidence</h2><p>Run each stage independently or follow the complete path. Every result stays linked to its source.</p></div>
      </section>

      <div className="workflow" aria-label="Pipeline progress">
        {TITLES.map((title, index) => <div className={`workflow-step ${states[index]}`} key={title}>
          <span className="workflow-number">{states[index] === "complete" ? "✓" : index + 1}</span><span>{t(title)}</span>
          {states[index] === "running" && <span className="step-state">Running</span>}
          {states[index] === "error" && <span className="step-state">Failed</span>}
        </div>)}
      </div>

      <div className="pipeline-grid">
        <Panel number="01" title="Input" id="stage-input">
          <label className="field-label" htmlFor="question">{t("question")}</label>
          <textarea id="question" className="question-input" value={question} onChange={(event) => {
            setQuestion(event.target.value);
            clearDownstream(4);
          }} placeholder={t("questionPlaceholder")} />
          <SampleQueryPicker language={language} api={api} onSelect={(sample) => { setQuestion(sample); clearDownstream(4); }} />
          <div className="source-choice" role="group" aria-label="Choose literary source">
            <button className={sourceMode === "prepared" ? "selected" : ""} onClick={() => { setSourceMode("prepared"); setSourceText(""); setSourceFile(null); resetForInputChange(); }}>{t("preparedCorpus")}</button>
            <button className={sourceMode === "custom" ? "selected" : ""} onClick={() => { setSourceMode("custom"); resetForInputChange(); }}>{t("myTextOrFile")}</button>
          </div>
          {sourceMode === "prepared" ? <div className="source-note"><strong>{t("canonicalCorpus")}</strong><span>Uses the project passages and their original provenance.</span></div> : <>
            <label className="field-label" htmlFor="source-text">Tamil or English text</label>
            <textarea id="source-text" className="source-input" value={sourceText} onChange={(event) => { setSourceText(event.target.value); setSourceFile(null); resetForInputChange(); }} placeholder="Paste the exact text to analyze…" />
            <label className="file-choice">{sourceFile ? `Selected: ${sourceFile.name}` : "Choose PDF, CSV, or TXT"}<input type="file" accept=".pdf,.csv,.txt" onChange={(event) => { setSourceFile(event.target.files?.[0] || null); resetForInputChange(); }} /></label>
          </>}
          {stageButton(0, t("runInput"), sourceMode === "prepared" || !!sourceFile || !!sourceText.trim())}
          {corpus && states[0] === "complete" && <p className="success-message">Input ready · {corpus.filename} · {corpus.status === "prepared_selected" ? "prepared corpus" : "user source preserved"}</p>}
          <ModuleFeedback severity={errors[0] ? "Error" : states[0] === "complete" ? "Ready" : "Information"} summary={errors[0] || (corpus ? "Selected source is ready." : "Choose the prepared corpus, text, or a supported file.")} suggestion={errors[0] ? failureSuggestions[0] : corpus ? undefined : "Use Prepared Silappatikāram Corpus or enter/upload a source."} technical={technicalErrors[0]} />
        </Panel>

        <Panel number="02" title="Tamil NLP / Preprocessing" id="stage-preprocessing">
          <p className="panel-copy">Normalize the selected text and inspect its passage, sentence, and token records.</p>
          {stageButton(1, "Run Preprocessing", states[0] === "complete")}
          {errors[1] && <p className="error-message">{errors[1]}</p>}
          {preprocessing && <div className="result-block">
            <div className="metric-row"><span><b>{preprocessing.passage_count}</b> passages</span><span><b>{preprocessing.sentence_count}</b> sentences</span><span><b>{preprocessing.entity_count}</b> linked entities</span></div>
            <p>{preprocessing.method}</p>
            <details><summary>Inspect extracted concepts and tokens</summary><div className="concept-list">{(preprocessing.concepts || []).slice(0, 12).map((item: RecordValue, index: number) => <span key={`${item.entity_id}-${index}`}>{item.word}{item.english ? ` · ${item.english}` : ""}</span>)}</div></details>
          </div>}
          <ModuleFeedback severity={errors[1] ? "Error" : preprocessing ? "Ready" : "Information"} summary={errors[1] || (preprocessing ? "Selected text was processed." : "Waiting for input to be completed.")} suggestion={errors[1] ? failureSuggestions[1] : preprocessing ? undefined : "Run Input first, then Run Preprocessing."} technical={technicalErrors[1]} />
        </Panel>

        <Panel number="03" title="Mīmāṃsā-based Interpretation" id="stage-meaning">
          <p className="panel-copy">Source-linked passage analysis across eight Mīmāṃsā-inspired dimensions.</p>
          {errors[2] && <p className="error-message">{errors[2]}</p>}
          {interpretation && <div className="result-block meaning-compact">
            <div className="meaning-result-heading">
              <div><span className="eyebrow">Passage analyzed</span><h3>{interpretation.passage_id}</h3></div>
              <div className="source-citation">{interpretation.source_file}<br />Pages {interpretation.page_start}-{interpretation.page_end}</div>
            </div>
            <p className="meaning-compact-summary">Eight dimensions recorded for this passage.</p>
          </div>}
          <div className="meaning-actions">
            {stageButton(2, "Run Interpretation", states[1] === "complete")}
            <button className="secondary-button" onClick={() => navigate("mimamsa")}>Detailed page</button>
          </div>
          <ModuleFeedback severity={errors[2] ? "Error" : interpretation ? "Ready" : "Information"} summary={errors[2] || (interpretation ? "Interpretation is available." : "No interpretation has been run yet.")} suggestion={errors[2] ? failureSuggestions[2] : interpretation ? undefined : "Run Preprocessing, then select a valid passage and run interpretation."} technical={technicalErrors[2]} />
        </Panel>

        <Panel number="04" title="Logical Representation" id="stage-logical">
          <p className="panel-copy">Generate source-linked propositions from the prepared annotations or entered passage.</p>
          {stageButton(3, "Generate Logical Representation", states[2] === "complete")}
          {errors[3] && <p className="error-message">{errors[3]}</p>}
          {states[3] === "complete" && <div className="result-block"><p>{propositions.length} evidence statements returned. The output records evidence; it does not establish independent facts.</p>
            <div className="proposition-list">{propositions.slice(0, 4).map((item) => <div key={item.proposition_id}><b>{item.proposition_id}</b><span>{item.fol_predicate || item.natural_language}</span></div>)}</div>
            {propositions.length > 4 && <details><summary>View remaining propositions ({propositions.length - 4})</summary><div className="proposition-list">{propositions.slice(4).map((item) => <div key={item.proposition_id}><b>{item.proposition_id}</b><span>{item.fol_predicate || item.natural_language}</span></div>)}</div></details>}
          </div>}
          <ModuleFeedback severity={errors[3] ? "Error" : states[3] === "complete" && propositions.length === 0 ? "Warning" : states[3] === "complete" ? "Ready" : "Information"} summary={errors[3] || (states[3] === "complete" && propositions.length === 0 ? "No validated propositions were found." : states[3] === "complete" ? `${propositions.length} source-linked propositions are ready.` : "Logical representation has not been generated." )} suggestion={errors[3] ? failureSuggestions[3] : states[3] === "complete" && propositions.length === 0 ? "Use a passage with validated annotations, or inspect the custom-text evidence record." : states[3] === "complete" ? undefined : "Run Interpretation, then Generate Logical Representation."} technical={technicalErrors[3]} />
        </Panel>

        <Panel number="05" title="Knowledge Graph" id="stage-graph">
          <p className="panel-copy">Find source-validated entities and relationships related to your question. The graph is shown on its dedicated page.</p>
          {stageButton(4, "Build Knowledge Graph Context", states[3] === "complete" && !!question.trim())}
          {errors[4] && <p className="error-message">{errors[4]}</p>}
          {graphData && <div className="result-block"><div className="metric-row"><span><b>{graphData.nodes.length}</b> nodes</span><span><b>{graphData.relationships.length}</b> relationships</span><span>Source: {graphData.backend}</span></div>
            <button className="secondary-button" onClick={() => setActiveView("graph")}>Explore Knowledge Graph</button>
          </div>}
          <ModuleFeedback severity={errors[4] ? "Error" : graphData?.backend === "csv" ? "Information" : graphData ? "Ready" : "Information"} summary={errors[4] || (graphData?.backend === "csv" ? "Validated CSV graph fallback is active." : graphData ? "Graph context is ready." : "Graph context has not been searched yet.")} suggestion={errors[4] ? failureSuggestions[4] : graphData?.backend === "csv" ? "Explore the validated graph; check Neo4j only if live graph access is required." : graphData ? undefined : "Run Logical Representation, then Build Knowledge Graph Context."} technical={technicalErrors[4]} />
        </Panel>

        <Panel number="06" title="Hybrid RAG · Evidence and Answer" id="stage-rag">
          <p className="panel-copy">Dense semantic retrieval, BM25, and graph context are fused against the canonical passage index.</p>
          {stageButton(5, "Find Evidence", states[4] === "complete" && !!question.trim())}
          {errors[5] && <p className="error-message">{errors[5]}</p>}
          {rag && <div className="rag-results">
            <div className="rag-action-bar" aria-label="Evidence actions">
              <button className="secondary-button" disabled={busyStage !== null || states[4] !== "complete"} onClick={() => void runStage(5)}>{busyStage === 5 ? "Finding evidence…" : "Find Evidence Again"}</button>
              <button className="secondary-button" disabled={!evidence.length || sourceBusy} onClick={() => void viewSource(evidence[0]?.passage_id)}>{sourceBusy ? "Loading source…" : "View Source"}</button>
              <button className="primary-button pdf-button" disabled={busyStage !== null} onClick={() => void downloadEvidence()}>{busyStage === "pdf" ? "Preparing PDF…" : pdfDownloaded ? "Download Evidence PDF Again" : "Download Evidence PDF"}</button>
            </div>
            <div className="rag-columns">
              <article className={`answer-card answer-${answerState}`}>
                <div className="answer-heading"><div><span className="eyebrow">Your Question</span><p className="rag-question">{rag.query}</p></div>
                  <span className={`answer-mode ${answerState}`}>{answerState === "generated" ? "LLM-generated" : answerState === "fallback" ? "Evidence-only fallback" : "Insufficient Evidence"}</span>
                </div>
                <h3>Answer</h3>
                <p className="answer-text">{answerState === "insufficient"
                  ? "The retrieved passages do not provide enough evidence to answer this question. No conclusion is asserted."
                  : answerState === "fallback"
                    ? "No generated conclusion is asserted. The retrieved passages below are the available evidence for review."
                    : rag.answer}</p>
                <div className="answer-status-row"><span className={`status-dot ${answerState}`} />{answerState === "generated" ? "Answer generated from retrieved evidence" : answerState === "fallback" ? "Evidence-only mode active · no LLM conclusion" : "No supporting passages retrieved"}</div>
                {sourceError && <p className="error-message">{sourceError}</p>}
                {pdfError && <p className="error-message">{pdfError}</p>}
                {pdfDownloaded && <p className="success-message">Evidence PDF downloaded with the current question and retrieved sources.</p>}
              </article>
              <section className="evidence-panel" aria-labelledby="evidence-found-heading">
                <div className="evidence-panel-heading"><div><h3 id="evidence-found-heading">Evidence Found</h3><span>{evidence.length} retrieved passages</span></div>
                  {sourceNames.length > 0 && <p className="source-count">{sourceNames.length} source{sourceNames.length === 1 ? "" : "s"}</p>}
                </div>
                {evidence.length === 0 ? <p className="empty-message">Try a more specific question or use a Tamil phrase from the passage.</p> : <div className="evidence-list">
                  {visibleEvidence.map((item) => {
                    const isExpanded = expandedPassages.includes(item.evidence_id);
                    const needsExpansion = item.passage_text.length > 320;
                    return <article className="evidence-card" key={item.evidence_id}>
                      <div className="evidence-card-heading"><b>{item.evidence_id} · {item.passage_id}</b><span>{item.kandam}</span></div>
                      <h4>Section {item.section_number}: {item.section_name}</h4>
                      <p className={`passage-text${isExpanded || !needsExpansion ? " expanded" : ""}`} lang="ta">{isExpanded || !needsExpansion ? item.passage_text : `${item.passage_text.slice(0, 100).trimEnd()}…`}</p>
                      {needsExpansion && <button className="text-toggle" onClick={() => setExpandedPassages((current) => isExpanded ? current.filter((id) => id !== item.evidence_id) : [...current, item.evidence_id])}>{isExpanded ? "Show less" : "Read full passage"}</button>}
                      <div className="citation-row"><span>{item.source_pdf || item.source_file} · pages {item.page_start}-{item.page_end}</span></div>
                      <details className="evidence-details"><summary>Details and provenance</summary>
                        <p>Retrieval methods: {(item.retrieval_methods || []).join(", ") || "not reported"}</p>
                        <p>Scores · Dense {item.dense_score} · BM25 {item.bm25_score} · Graph {item.graph_score} · RRF {item.rrf_score} · Final {item.final_score}</p>
                        {item.provenance?.length > 0 && <ul>{item.provenance.map((edge: RecordValue) => <li key={edge.relationship_id}><b>{edge.relationship_type}</b> · {edge.evidence} · {edge.source_file} pp. {edge.source_page_start}-{edge.source_page_end}</li>)}</ul>}
                      </details>
                    </article>;
                  })}
                </div>}
                {evidence.length > 3 && <button className="show-evidence" onClick={() => { setShowAllEvidence((value) => !value); if (showAllEvidence) setExpandedPassages([]); }}>{showAllEvidence ? "Collapse evidence" : `Show ${evidence.length - 3} more evidence passages`}</button>}
              </section>
            </div>
            <div className="retrieval-summary" aria-label="Retrieval summary">
              <span><b>Dense</b>{rag.retrieval_metadata?.dense_enabled ? "Available" : "Unavailable"}</span>
              <span><b>BM25</b>{rag.retrieval_metadata?.bm25_enabled ? "Active" : "Off"}</span>
              <span><b>Graph</b>{rag.retrieval_metadata?.graph_enabled ? rag.retrieval_metadata?.graph_backend : "Off"}</span>
              <span><b>RRF / reranking</b>{rag.retrieval_metadata?.reranker_enabled ? "Active" : "RRF active"}</span>
              <span><b>Passages</b>{evidence.length}</span>
              <span><b>Status</b>{insufficientEvidence ? "Insufficient evidence" : "Evidence found"}</span>
            </div>
            <details className="how-generated"><summary>How was this answer generated? · Technical details</summary><p>The exact question is used for answer generation. Candidate passages are retrieved from the canonical corpus using the persistent multilingual vector index, BM25, and validated graph context, then fused and reranked. The LLM receives only this retrieved context. When no LLM is configured, the interface reports an evidence-only fallback.</p>
              <div className="technical-details">Graph source: {rag.retrieval_metadata?.graph_backend} · Embedding model: {rag.retrieval_metadata?.embedding_model} · Index: {rag.retrieval_metadata?.index_version}{rag.retrieval_metadata?.index_stale ? " (stale)" : ""} · Candidates: {rag.retrieval_metadata?.candidate_count} · Latency: {rag.retrieval_metadata?.latency_ms} ms</div>
            </details>
          </div>}
          <ModuleFeedback severity={errors[5] || pdfError ? "Error" : insufficientEvidence && rag ? "Warning" : rag?.retrieval_metadata?.index_stale ? "Warning" : rag?.answer_mode === "evidence_only_fallback" || (rag && !rag.retrieval_metadata?.dense_enabled) ? "Information" : rag ? "Ready" : "Information"} summary={errors[5] || pdfError || (insufficientEvidence && rag ? "No supporting evidence was retrieved." : rag?.retrieval_metadata?.index_stale ? "The retrieval index is marked stale." : rag?.answer_mode === "evidence_only_fallback" ? "Evidence-only mode is active; no LLM conclusion was generated." : rag && !rag.retrieval_metadata?.dense_enabled ? "Dense retrieval is unavailable." : pdfDownloaded ? "Evidence PDF downloaded." : rag ? "Evidence retrieval is ready." : "Evidence retrieval has not been run yet.")} suggestion={errors[5] ? failureSuggestions[5] : pdfError ? "Check Tamil Unicode font configuration and retry the PDF." : insufficientEvidence && rag ? "Try a more specific question." : rag?.retrieval_metadata?.index_stale ? "Rebuild the RAG Index." : rag?.answer_mode === "evidence_only_fallback" ? "Configure an LLM endpoint to enable generated answers; evidence remains available." : rag && !rag.retrieval_metadata?.dense_enabled ? "Continue with BM25 + Graph Retrieval." : rag ? undefined : "Run the previous stages, then Find Evidence."} technical={technicalErrors[5] || pdfTechnical} />
        </Panel>
      </div>
      {sourceDetails && <div className="source-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSourceDetails(null); }}>
        <section className="source-dialog" role="dialog" aria-modal="true" aria-labelledby="source-dialog-title">
          <div className="source-dialog-head"><div><span className="eyebrow">Canonical corpus · {sourceDetails.passage_id}</span><h2 id="source-dialog-title">Source Passage</h2></div><button className="icon-button" aria-label="Close source passage" onClick={() => setSourceDetails(null)}>×</button></div>
          <p className="source-dialog-meta">{sourceDetails.kandam} · Section {sourceDetails.section_number}: {sourceDetails.section_name}</p>
          <p className="source-dialog-text" lang="ta">{sourceDetails.passage_text}</p>
          <p className="source-dialog-meta">{sourceDetails.source_file} · pages {sourceDetails.page_start}-{sourceDetails.page_end}</p>
        </section>
      </div>}
      <footer className="page-footer">Silappatikāram · Research evidence is traceable to passages, source pages, and validated graph provenance.</footer>
    </main>
  </div>;
}

function Sidebar({ active, onNavigate, language, onLanguageChange }: { active: string; onNavigate: (destination: string) => void; language: Language; onLanguageChange: (language: Language) => void }) {
  const t = (key: string) => translate(language, key);
  const items = [
    ["workflow", "⌂", "home"],
    ["stage-input", "▤", "literaryCorpus"],
    ["stage-preprocessing", "◉", "preprocessing"],
    ["stage-meaning", "◇", "interpretation"],
    ["stage-logical", "∴", "logicalRepresentation"],
    ["graph", "◎", "knowledgeGraph"],
    ["stage-rag", "⌕", "hybridRag"],
  ];
  return <aside className="sidebar">
    <a className="brand" href="#workflow" onClick={(event) => { event.preventDefault(); onNavigate("workflow"); }}><span className="brand-mark">S</span><span><b>Silappatikāram</b><small>Evidence Lab</small></span></a>
    <nav aria-label="Main navigation">{items.map(([destination, icon, label]) => <button key={destination} className={active === destination ? "active" : ""} onClick={() => onNavigate(destination)}><span aria-hidden="true">{icon}</span>{t(label)}</button>)}</nav>
    <div className="language-switcher" aria-label={t("language")}><span>{t("language")}</span><button className={language === "en" ? "active" : ""} onClick={() => onLanguageChange("en")}>EN</button><button className={language === "ta" ? "active" : ""} onClick={() => onLanguageChange("ta")}>தமிழ்</button></div>
    <div className="sidebar-footer">Mīmāṃsā-based literary reasoning<br />Source-grounded research</div>
  </aside>;
}

function ModuleFeedback({ severity, summary, suggestion, technical }: {
  severity: Severity;
  summary: string;
  suggestion?: string;
  technical?: string;
}) {
  return <details className={`module-feedback severity-${severity.toLowerCase()}`}>
    <summary><span className="severity-badge">{severity}</span><span>Errors &amp; Suggestions</span><b>{summary}</b></summary>
    <div className="feedback-content">
      <p>{summary}</p>
      {suggestion && <p><strong>Suggested action:</strong> {suggestion}</p>}
      {technical && <details className="technical-error"><summary>Technical details</summary><code>{technical}</code></details>}
    </div>
  </details>;
}

function getStageFailure(index: number, error: unknown): { message: string; suggestion: string; technical: string } {
  const technical = error instanceof ApiError
    ? error.technical
    : error instanceof Error ? error.message : "Unexpected service error";
  const normalized = technical.toLowerCase();
  if (index === 0 && normalized.includes("unsupported file extension")) {
    return { message: "This file type is not supported.", suggestion: "Use Prepared Silappatikāram Corpus or choose a PDF, CSV, or TXT file.", technical };
  }
  if (index === 0 && normalized.includes("encoding")) {
    return { message: "The file encoding could not be read.", suggestion: "Save the text as UTF-8 or use Prepared Silappatikāram Corpus.", technical };
  }
  if (index === 0 && normalized.includes("empty")) {
    return { message: "No readable text was found in this input.", suggestion: "Choose another file or paste the source text.", technical };
  }
  const messages = [
    ["Input could not be prepared.", "Use Prepared Silappatikāram Corpus or select a valid source."],
    ["Preprocessing could not be completed.", "Run Preprocessing Again."],
    ["Interpretation is unavailable for this source.", "Select a valid passage and run interpretation."],
    ["No validated logical representation could be created.", "Check the source, then Generate Logical Representation again."],
    ["Graph context could not be loaded.", "Use the validated CSV graph fallback or check the Neo4j connection."],
    ["Evidence retrieval could not be completed.", "Try Find Evidence Again or use a more specific question."],
  ];
  return { message: messages[index]?.[0] || "This step could not be completed.", suggestion: messages[index]?.[1] || "Retry the step after checking its input.", technical };
}