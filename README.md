# Explainable Silappatikaram Reasoning

Academic research prototype for explainable Silappatikaram analysis using Tamil text processing, Mimamsa-inspired interpretation, formal evidence propositions, a hierarchical knowledge graph, and hybrid KG-RAG retrieval.

The current workflow covers input, preprocessing, Mīmāṃsā-inspired interpretation, evidence propositions, graph context, hybrid retrieval, and an optional evidence-grounded answer. Nyāya inference, formal verification, proof generation, and justification are not implemented.

## Pipeline

```text
Silappatikaram PDFs
        |
        v
Processed passages, entities, events, relationships
        |
        v
Mimamsa-inspired interpretation
        |
        v
Evidence-only propositions
        |
        v
Neo4j knowledge graph
        |
        v
Hybrid KG-RAG retrieval
        |
        v
Optional LLM answer from retrieved context
        |
        v
Evidence with provenance or explicit evidence-only fallback
```

## Implemented Modules

### Module 1: Literary Corpus Input

- PDF, CSV, and TXT upload
- Prepared dataset selection
- File type, size, encoding, CSV schema, and duplicate-ID validation
- SHA-256 source identification
- Upload status and provenance metadata

Endpoint:

```text
POST /api/corpus/upload
```

### Module 2: Tamil NLP / Preprocessing

- Unicode normalization
- Whitespace cleanup
- Passage and sentence segmentation
- Whitespace tokenization fallback
- Prepared entity linking from `entities.csv`
- Explicit capability labels when Tamil morphology or POS tools are unavailable

Endpoint:

```text
POST /api/preprocessing/run
```

### Module 3: Mīmāṃsā-Inspired Interpretation

Structured, source-grounded records for:

- Śabda
- Padārtha
- Vākya
- Ākāṅkṣā
- Yogyatā
- Sannidhi
- Prakaraṇa
- Tātparya

Endpoint:

```text
POST /api/interpretation/run
```

### Module 4: Formal Proposition Generation

Propositions are generated only from validated relationship annotations. They are marked as `EVIDENCE`; the service does not upgrade annotations into facts or perform Nyaya reasoning.

Endpoint:

```text
POST /api/propositions/generate
```

### Module 5: Hierarchical Knowledge Graph

- Validates Neo4j-ready nodes and relationships
- Rejects orphan relationships and duplicate IDs
- Preserves relationship provenance
- Provides graph search and subgraph APIs
- Supports an optional live Neo4j adapter
- Uses validated CSV data as a safe local fallback

Endpoints:

```text
GET /api/graph/entity/{entity_id}
GET /api/graph/subgraph/{entity_id}
GET /api/graph/passage/{passage_id}
GET /api/graph/search?q=Kovalan
```

The prepared graph export currently validates to **96 nodes** and **354 relationships**.

### Module 6: Hybrid KG-RAG Retrieval

- Dedicated query understanding and controlled graph-name entity linking
- Persistent, dataset-hashed RAG index in `.rag_index/`
- BM25 lexical retrieval over the original Tamil passage corpus
- Optional multilingual dense retrieval using SentenceTransformers
- Knowledge graph retrieval with live Neo4j support and validated CSV fallback
- Candidate-pool retrieval followed by Reciprocal Rank Fusion (RRF)
- Configurable reranking fallback, filters, and query cache
- Retrieval diagnostics, index versioning, and provenance-preserving evidence objects
- `INSUFFICIENT_EVIDENCE` response when no evidence is found
- Optional OpenAI-compatible LLM answers restricted to retrieved passages and graph provenance
- Explicit evidence-only fallback when no LLM is configured or available
- Backend-generated PDF evidence report from the current query and retrieved results

Endpoint:

```text
POST /api/rag/query
POST /api/rag/evidence.pdf
```

Example request:

```json
{
  "query": "Did Kovalan steal the queen's anklet?",
        "context": "Optional exact user-entered or extracted source text",
  "top_k": 5
}
```

`query` remains the exact question shown in the UI and sent to answer generation. Optional `context` enriches graph and passage retrieval; answers are grounded in retrieved literary evidence, not unverified user text.

## Project Structure

```text
backend/
  api/                 FastAPI route modules
  application/         Corpus, preprocessing, interpretation, proposition, graph, and RAG services
  domain/              Validation schemas
  tests/               Backend tests
  main.py              FastAPI application

frontend/
  src/App.tsx          Main research workflow
  src/*Panel.tsx       Module panels
  src/styles.css       Academic dashboard styling
  package.json         Vite/React configuration

data/
  raw/                 Original literary PDFs, when present
  processed/           Passage, entity, event, and relationship CSVs
  neo4j/               Neo4j-ready nodes and relationships

prompt/                Project and module specifications
```

## Requirements

- Python 3.11 or newer
- Node.js 20.18 or newer
- npm
- Neo4j Desktop is optional for the current CSV-backed development mode

## Install Backend

From Git Bash:

```bash
cd /d/Silapathikaram
python -m pip install -r backend/requirements.txt
```

## Run Backend

From the repository root:

```bash
cd /d/Silapathikaram
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

Alternatively, from the `backend` directory:

```bash
cd /d/Silapathikaram/backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The API is available at `http://localhost:8000`.

FastAPI's interactive API documentation is available at:

```text
http://localhost:8000/docs
```

## Run Frontend

Open a second terminal:

```bash
cd /d/Silapathikaram/frontend
npm install
npm run dev
```

Open the Vite URL shown in the terminal, normally:

```text
http://localhost:5173
```

The frontend expects the backend at `http://localhost:8000`.

For a different API host, copy `frontend/.env.example` to `frontend/.env` and set
`VITE_API_URL`. The dashboard stores the English/Tamil interface choice in the
browser and keeps query language and original source passages independent from
that interface setting.

## Production Configuration

The backend exposes `GET /health` for container or load-balancer checks and
`GET /api/samples` for bounded sample-query retrieval. Sample queries are read
from `data/silappatikaram_sample_queries_1000.txt`, classified using the Tamil
Unicode block, and never returned wholesale by the API. Use `search`, `language`,
`category`, `limit`, and `random_sample` query parameters to drive the UI.

Set `CORS_ORIGINS` to a comma-separated list of deployed frontend origins. Do
not put Neo4j passwords or LLM keys in source control; use environment variables
or the deployment platform's secret store. Neo4j and dense retrieval remain
optional: the validated CSV graph and BM25 retrieval continue to operate when
those services are unavailable.

Build and serve the frontend with:

```bash
cd /d/Silapathikaram/frontend
npm ci
npm run build
npm run preview -- --host 0.0.0.0
```

Run the backend with a production process manager (for example, one Uvicorn
worker per container):

```bash
cd /d/Silapathikaram
uvicorn backend.main:app --host 0.0.0.0 --port 8000
```

Place a reverse proxy or platform TLS termination in front of both services,
route `/api` and `/health` to the backend, and serve the Vite `frontend/dist`
directory as the single-page application. Verify `/health`, `/api/samples`,
`/api/graph/search?q=Kovalan`, and `/api/rag/query` after deployment.

## Using the Dashboard

The research workflow can run one stage at a time or use **Run Complete Pipeline**:

1. **Input**: choose the prepared Silappatikāram corpus, paste Tamil text, or upload a PDF/CSV/TXT file.
2. **Preprocessing**: prepare the selected text and inspect the passage count, sentence count, concepts, and parsed words.
3. **Mīmāṃsā Interpretation**: record the source-grounded interpretation steps for the selected passage.
4. **Logical Formulas**: create evidence statements from supported relationship annotations. This does not determine truth.
5. **Knowledge Graph**: retrieve validated graph context and open the dedicated Cytoscape explorer.
6. **Evidence retrieval**: find original Tamil passages using dense, BM25, and graph signals.
7. **Answer**: use the configured LLM with retrieved evidence, or clearly label the evidence-only fallback.

Prepared corpus selection uses the project's canonical processed data. Pasted text and extracted upload text are stored with their corpus session and passed to preprocessing, interpretation, propositions, and retrieval context. The user's question remains separate and unchanged. Custom text without validated graph annotations does not acquire fabricated relationships.

The graph uses Cytoscape.js on a dedicated page. Circular nodes are categorized by validated node types; selecting a node or relationship focuses its local neighborhood. Search, category filtering, 1-hop/2-hop expansion, fit, zoom, and reset controls operate on validated graph data.

The dashboard displays computed values from the backend. The prepared corpus preprocessing response currently contains 30 passages and 291 annotated concepts. RAG relevance, graph connections, and formulas are returned by backend services; no example values are inserted into the UI. Technical retrieval scores remain in expandable details.

## Build the RAG Index

Build the persistent index from the actual 30-row passage corpus:

```bash
cd /d/Silapathikaram
python scripts/build_rag_index.py
```

The command writes `.rag_index/rag_index_metadata.json`, `.rag_index/bm25.json`, and `.rag_index/vectors.json`. Dataset and embedding-model changes mark the index stale; API requests do not rebuild it automatically.

Dense retrieval requires the optional `sentence-transformers` dependency and a multilingual model. Without it, the service reports `dense_enabled: false` and continues with BM25 plus graph retrieval.

Answer generation is optional. Configure an OpenAI-compatible Chat Completions endpoint to enable it:

```text
RAG_LLM_API_URL=https://api.openai.com/v1/chat/completions
RAG_LLM_API_KEY=your-local-api-key
RAG_LLM_MODEL=your-model-name
```

Keep credentials local and do not commit them. Without a working endpoint and model, the UI reports an evidence-only fallback and does not claim that an LLM generated an answer. PDF evidence reports embed the installed Tamil Unicode font and shape Tamil with HarfBuzz; `Latha`/`Arial` are discovered on Windows, with Noto/DejaVu fallbacks on Linux. Configure `SILAPATHIKARAM_TAMIL_FONT` and `SILAPATHIKARAM_LATIN_FONT` when automatic font discovery is unavailable. PDF extraction and export dependencies (`pypdf`, `reportlab`, and `uharfbuzz`) are in `backend/requirements.txt`; the service refuses to emit a report if Tamil font shaping is unavailable.

Run the retrieval evaluation baseline:

```bash
python scripts/evaluate_rag.py
```

## Run Tests and Build

Backend tests:

```bash
cd /d/Silapathikaram
python -m pytest -q
```

Frontend production build:

```bash
cd /d/Silapathikaram/frontend
npm run build
```

Frontend preview:

```bash
npm run preview
```

## Neo4j Configuration

Neo4j is the structured knowledge/evidence layer. It is not a replacement for the original PDFs or processed passage corpus.

The project includes a local `.env` file template. Fill in `NEO4J_PASSWORD` there, then start the backend normally. The application loads `.env` automatically and can still use the validated CSV repository without Neo4j credentials.

```text
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=your-local-password
NEO4J_DATABASE=neo4j
```

Alternatively, set environment variables before starting the backend:

```bash
export NEO4J_URI="bolt://localhost:7687"
export NEO4J_USER="neo4j"
export NEO4J_PASSWORD="your-local-password"
export NEO4J_DATABASE="neo4j"
```

On Windows PowerShell, use:

```powershell
$env:NEO4J_URI = "bolt://localhost:7687"
$env:NEO4J_USER = "neo4j"
$env:NEO4J_PASSWORD = "your-local-password"
$env:NEO4J_DATABASE = "neo4j"
```

Do not commit credentials. A local Neo4j installation should contain the imported `nodes.csv` and `neo4j_relationships.csv` in its import directory, but the project data files must remain unchanged.

## RAG Ranking Configuration

The current hybrid ranking uses weighted Reciprocal Rank Fusion:

```text
RRF contribution = weight / (RRF constant + rank)
dense = 0.40
bm25 = 0.30
graph = 0.30
```

Configure retrieval with environment variables:

```bash
export RAG_EMBEDDING_MODEL="sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
export RAG_RRF_K="60"
export RAG_CANDIDATE_TOP_K="20"
export RAG_RERANK_TOP_K="20"
export RAG_CACHE_TTL_SECONDS="300"
export RAG_MIN_DENSE_SCORE="0.30"
```

The index directory can be changed with `RAG_INDEX_DIR`. Dense-only candidates below `RAG_MIN_DENSE_SCORE` are rejected unless BM25 or validated graph evidence corroborates them. The query API also accepts `filters`, `use_dense`, `use_bm25`, `use_graph`, and `use_reranker` controls.

## Data Integrity Rules

- Original literary PDFs must not be overwritten.
- Processed CSV files must not be silently renamed or replaced.
- Neo4j is a structured graph layer, not the original literary corpus.
- Retrieved passage text must come from `passages.csv` or a validated corpus.
- Graph relationships must have valid endpoints and provenance.
- Interpretation and propositions must retain source passage and page information.
- LLM answers must use retrieved evidence and citations; without a configured LLM, the system reports an evidence-only fallback.
- Evidence PDF exports are generated on the backend from the submitted question and current retrieval results.

## Example API Calls

Prepared corpus selection:

```bash
curl -X POST -F "use_prepared=true" http://localhost:8000/api/corpus/upload
```

Run preprocessing:

```bash
curl -X POST http://localhost:8000/api/preprocessing/run
```

Search the graph:

```bash
curl "http://localhost:8000/api/graph/search?q=Kovalan"
```

Retrieve evidence:

```bash
curl -X POST http://localhost:8000/api/rag/query \
  -H "Content-Type: application/json" \
  -d '{"query":"Did Kovalan steal the queen'"'"'s anklet?","top_k":5}'

## Example Test Inputs

These examples are for testing the interface and retrieval behavior. They are not added to or treated as authoritative literary evidence.

### Tamil Text Input

Paste this into the **Input** panel:

```text
கோவலன் சிலம்புடன் மதுரைக்குச் சென்றான். கண்ணகி அவனுடன் சென்றாள். மதுரையில் கோவலன் ஒரு சிலம்பை விற்க முயன்றான். அரசியின் சிலம்பு காணாமல் போனதாக கூறப்பட்டது. கோவலன் மீது குற்றச்சாட்டு முன்வைக்கப்பட்டது.
```

Expected behavior:

- Preprocessing shows every entered word in parsed structure.
- The sentence count is calculated from the entered text.
- No prepared entities are invented.
- Interpretation uses the entered corpus ID.
- Formulas show no supported statements unless annotations exist.
- The graph reports no connections if the text has no graph annotations.

### English Text Input

```text
Kovalan travelled to Madurai with Kannaki. He tried to sell an anklet. The queen's anklet was reported missing, and Kovalan was accused of theft.
```

### Prepared Corpus Graph Searches

Use the prepared corpus and test these graph contexts:

```text
Kovalan anklet
Kannaki
Queen
MAT_010
Kovalan execution
Madurai
```

The graph should show only matching nodes and their nearby relationships. It should not render the entire graph by default.

### RAG Questions

Use the **RAG Retrieval** panel with:

```text
Did Kovalan steal the queen's anklet?
```

```text
Who presents evidence about the anklet?
```

```text
Where does Kovalan's execution occur?
```

```text
கண்ணகி சிலம்பு
```

```text
unknown object that is not in the corpus
```

The first queries should return actual source passages when matching evidence exists. The unknown query should return no matching evidence. RAG always keeps `conclusion` as `null`.

### API Test Examples

Prepare the actual corpus:

```bash
curl -X POST -F "use_prepared=true" http://localhost:8000/api/corpus/upload
```

Prepare the corpus and inspect generated concepts and parsed words:

```bash
curl -X POST http://localhost:8000/api/preprocessing/run
```

Interpret a prepared passage:

```bash
curl -X POST "http://localhost:8000/api/interpretation/run?passage_id=MAT_010"
```

Generate evidence statements for a prepared passage:

```bash
curl -X POST "http://localhost:8000/api/propositions/generate?passage_id=MAT_010"
```

Find focused graph connections:

```bash
curl "http://localhost:8000/api/graph/search?q=Kovalan%20anklet"
```

Find ranked evidence:

```bash
curl -X POST http://localhost:8000/api/rag/query \
        -H "Content-Type: application/json" \
        -d '{"query":"Kovalan anklet","top_k":3}'
```
```

## Current Limitations

- Tamil morphology and POS tagging use explicit fallback labels when specialized libraries are unavailable.
- Dense retrieval is optional and is explicitly disabled when the configured embedding provider/model is unavailable; BM25 and graph retrieval continue to operate.
- The UI uses a focused Cytoscape.js graph rather than rendering the entire 96-node graph at once.
- Neo4j connectivity is optional; local tests use the validated Neo4j-ready CSV export.
- User-entered text is persisted in ignored `.runtime/user_corpora.json` and remains separate from the canonical literary corpus and RAG index.
- Nyaya reasoning and final conclusions are intentionally deferred.
