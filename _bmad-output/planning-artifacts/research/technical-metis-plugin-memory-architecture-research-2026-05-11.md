---
stepsCompleted: [1, 2, 3, 4, 5, 6]
inputDocuments: ['metis-project-foundation.docx']
workflowType: 'research'
lastStep: 1
research_type: 'technical'
research_topic: 'Metis Plugin Memory Architecture — Memory Schema, Hindsight, MemRL, and Mem0'
research_goals: 'Evaluate four open architecture questions: (1) memory schema design for delegation outcomes, (2) Hindsight library vs custom four-network implementation, (3) MemRL library vs custom Q-value scoring, (4) Mem0 as drop-in memory layer vs custom implementation'
user_name: 'Somyung'
date: '2026-05-11'
web_research_enabled: true
source_verification: true
---

# Research Report: Metis Plugin Memory Architecture

**Date:** 2026-05-11
**Author:** Somyung
**Research Type:** Technical

---

## Technical Research Scope Confirmation

**Research Topic:** Metis Plugin Memory Architecture — Memory Schema, Hindsight, MemRL, and Mem0
**Research Goals:** Evaluate four open architecture questions: (1) memory schema design for delegation outcomes, (2) Hindsight library vs custom four-network implementation, (3) MemRL library vs custom Q-value scoring, (4) Mem0 as drop-in memory layer vs custom implementation

**Technical Research Scope:**

- Architecture Analysis — design patterns, frameworks, system architecture
- Implementation Approaches — development methodologies, coding patterns
- Technology Stack — languages, frameworks, tools, platforms
- Integration Patterns — APIs, protocols, interoperability
- Performance Considerations — scalability, optimization, patterns

**Research Methodology:**

- Current web data with rigorous source verification
- Multi-source validation for critical technical claims
- Confidence level framework for uncertain information
- Comprehensive technical coverage with architecture-specific insights

**Scope Confirmed:** 2026-05-11

---

## Research Overview

Four open architecture questions from the Metis project foundation document were researched in parallel using live web sources (GitHub repos, npm registries, arXiv papers, official docs). Each question was assigned a dedicated research agent. All library claims were verified against current repo state and documentation as of 2026-05-11.

---

## Synthesis & Recommendations

### Decision Matrix

| Question | Library Option | Verdict | Recommended Path |
|---|---|---|---|
| Memory schema | — (design question) | ✅ Clear answer | Schema defined below; use OTel field names, EMA Q-values, task-type priors |
| Hindsight | `vectorize-io/hindsight` | ❌ Wrong runtime | Build custom with `better-sqlite3` + `sqlite-vec` |
| MemRL | `MemTensor/MemRL` | ❌ Python only | Build custom; Thompson Sampling bandit first, fastembed Phase 1 second |
| Mem0 | `mem0ai` (npm) | ⚠️ Optional | Use for storage/retrieval if you want hybrid search; skip if latency is critical |

### The Architecture That Falls Out of This Research

All four answers point to the same implementation pattern:

```
.metis/
├── memory.mjs          ← Hindsight four-network (custom, better-sqlite3 + sqlite-vec)
│   ├── retain(outcome) ← post-delegation: write DelegationOutcome to experiences network
│   ├── recall(context) ← pre-delegation: cosine search across four networks
│   └── reflect(task)   ← routing: synthesize entity summaries + beliefs → provider choice
├── router.mjs          ← MemRL two-phase retrieval
│   ├── phase1()        ← semantic filter via fastembed BGEBaseEN (384-dim cosine)
│   └── phase2()        ← Thompson Sampling bandit per (task_type, provider)
└── schema.mjs          ← DelegationOutcome type, computeReward(), updateQValue(), Q_INIT_PRIORS
```

**No Python. No Postgres. No cloud accounts. No daemon startup.**  
Total added npm dependencies: `better-sqlite3`, `sqlite-vec`, `fastembed`.  
Estimated implementation: ~600 lines of .mjs.

### Build Sequence (Validated by Research)

**Phase 1 — Ship routing intelligence immediately (zero new dependencies):**
- Implement `schema.mjs`: `DelegationOutcome` type, `computeReward()`, `updateQValue()`, `Q_INIT_PRIORS`
- Implement pure Thompson Sampling bandit (`bandits.mjs`, ~40 lines): `selectProvider(category, providers)` + `update(category, provider, success)`. Persist state as a flat JSON file.
- This delivers "learns which provider works" with no infrastructure.

**Phase 2 — Add persistent structured memory (`better-sqlite3` + `sqlite-vec`):**
- Implement `memory.mjs` with four SQLite tables + sqlite-vec virtual tables for ANN search
- `retain()` writes `DelegationOutcome` records + first-person Hindsight narrative
- `recall()` does cosine search across four networks with token budget
- `reflect()` pulls entity summaries and evolving beliefs to synthesize routing decision

**Phase 3 — Add semantic Phase 1 embedding (`fastembed`):**
- Replace TF-IDF or keyword matching in `phase1()` with `fastembed` BGEBaseEN embeddings
- Embed `task_description + task_type + language` — store both the vector and source string
- Phase 1 pre-filters by `language` and `task_type` before cosine similarity scoring
- Above ~5,000 entries: upgrade Phase 1 from linear scan to `usearch` (WebAssembly ANN)

**Optional Phase 4 — Mem0 as alternative backend:**
- Offer `METIS_MEMORY_BACKEND=mem0` for users who want hybrid semantic+keyword+entity retrieval
- Map three-layer scope to `userId`/`agentId` scheme
- Still requires custom Q-value scoring layer on top — Mem0 does not replace router.mjs
- Use `embedder: { provider: "ollama" }` for fully offline operation

### Key Design Decisions Resolved

| Decision | Answer |
|---|---|
| Q-value update rule | EMA: `q_new = (1-α)*q_old + α*reward` with α=0.1 (same as MemRL, gamma=0) |
| Q-value initialization | Per-task-type priors from AIDev acceptance rates (not flat 0.5) |
| Reward formula | `0.50×outcome + 0.30×test_pass + 0.10×cost + 0.10×duration` (BaRP weights) |
| Phase 1 embedding target | `task_description + " " + task_type + " " + language` |
| Phase 2 algorithm | Thompson Sampling (beats ε-greedy by ~26% query reduction per 2025 study) |
| Storage backend | SQLite (better-sqlite3 + sqlite-vec) — zero infrastructure |
| Field naming | OTel `gen_ai.*` conventions for future observability integration |
| Hindsight narrative format | First-person, for Experience network: "I successfully completed a refactor task..." |
| Embedding model | fastembed BGEBaseEN (384-dim, top MTEB, ONNX-native, no API key) |

---

<!-- Content will be appended sequentially through research workflow steps -->

---

## Open Question 1: Memory Schema — Fields for Delegation Outcome Records

### Executive Summary

No production system publishes a ready-to-adopt schema matching Metis's requirements. The field has converged on conventions from three orthogonal sources: MemRL's Intent-Experience-Utility triplet, OpenTelemetry's GenAI semantic conventions, and the CLEAR framework's multi-dimensional performance encoding. The schema below synthesizes all three.

### Essential Fields

**Identity & Provenance**
- `id` — UUID v4
- `workspace_id` — absolute path to workspace root
- `repo_root` — absolute path to repo root at time of task
- `created_at` — ISO 8601 timestamp (critical for recency decay)

**Task Characterization** (drives semantic retrieval)
- `task_description` — 1-3 sentence natural language summary (embedding target)
- `task_type` — normalized enum (see taxonomy below)
- `task_subtype` — optional secondary qualifier (e.g. `"fix/compile"`)
- `task_intent_embedding` — float32[] vector; embed `task_description + " " + task_type + " " + language`
- `language` — primary programming language
- `complexity_hint` — `"trivial" | "moderate" | "complex"`

**Provider Attribution** (OTel `gen_ai.*` aligned)
- `provider` — `"codex" | "copilot" | "ollama"`
- `provider_model` — specific model ID (e.g. `"qwen2.5-coder:7b"`)
- `routing_reason` — why this provider was chosen

**Outcome**
- `outcome` — `"success" | "partial" | "failure" | "timeout" | "refused"`
- `exit_code` — integer; 0 = success
- `error_type` — OTel `error.type` value or domain-specific class (`"compile_error"`, `"test_failure"`, `"hallucinated_imports"`, `"context_window_exceeded"`, etc.)
- `error_detail` — nullable; first 512 chars of error message
- `files_touched` — string[]; relative paths modified/created/deleted
- `test_passed` — nullable boolean; post-delegation test suite result
- `diff_size_lines` — net lines changed

**Performance Metrics** (OTel `gen_ai.usage.*` aligned)
- `duration_ms`, `input_tokens`, `output_tokens`, `cost_usd`

**RL Signal**
- `reward_signal` — float [0–1]; composite reward computed post-task
- `utility_q` — float [0–1]; learned Q-value; initialized per task-type prior, updated via EMA

**Hindsight Network Tag**
- `network` — always `"experience"` for delegation outcome records

### Task Type Taxonomy

Two-level taxonomy validated by the AIDev study (12-category analysis, 66–84% PR acceptance rates by type):

```
Primary: feat | fix | refactor | test | docs | style | perf | build | ci | chore | revert | migration | review
Optional qualifier: feat/api, fix/compile, fix/runtime, test/unit, test/e2e, refactor/extract
```

AIDev acceptance rates inform Q-value priors: `chore=0.84, docs=0.82, style=0.78, refactor=0.71, feat=0.66, fix=0.66, test=0.62, perf=0.55`.

### Provider Performance Encoding

**Store raw scalars; compute categorical labels at query time.** Three encodings exist:
- **Raw scalar** (MemRL, BaRP): `utility_q` float [0,1] per `(provider, task_type)`. Supports smooth RL updates.
- **Categorical** (CLEAR framework): `"excellent"|"good"|"poor"|"failed"` — for display only.
- **Relative ranking** (ELO/dueling bandit): pairwise win/loss — statistically robust but rare in practice.

**Composite reward formula** (from BaRP paper, validated for multi-provider LLM routing):
```
r = 0.50×outcome_score + 0.30×test_score + 0.10×cost_score + 0.10×duration_score
```

### Recommended .mjs Schema

```javascript
// schema.mjs — DelegationOutcome record type for Metis memory system

/** @typedef {"feat"|"fix"|"refactor"|"test"|"docs"|"style"|"perf"|"build"|"ci"|"chore"|"revert"|"migration"|"review"} TaskType */
/** @typedef {"codex"|"copilot"|"ollama"} Provider */
/** @typedef {"success"|"partial"|"failure"|"timeout"|"refused"} Outcome */
/** @typedef {"trivial"|"moderate"|"complex"} Complexity */

export const ERROR_TYPES = Object.freeze({
  API_TIMEOUT:          "api_timeout",
  CONTEXT_WINDOW:       "context_window_exceeded",
  RATE_LIMITED:         "rate_limited",
  PROVIDER_UNAVAILABLE: "provider_unavailable",
  COMPILE_ERROR:        "compile_error",
  TEST_FAILURE:         "test_failure",
  RUNTIME_ERROR:        "runtime_error",
  HALLUCINATED_IMPORTS: "hallucinated_imports",
  REFUSED_UNSAFE:       "refused_unsafe",
  INCOMPLETE_OUTPUT:    "incomplete_output",
});

/** Per-type Q-value initialization priors from AIDev acceptance rates */
export const Q_INIT_PRIORS = Object.freeze({
  chore: 0.84, docs: 0.82, style: 0.78, ci: 0.75, build: 0.73,
  refactor: 0.71, feat: 0.66, fix: 0.66, test: 0.62, revert: 0.60,
  perf: 0.55, migration: 0.55, review: 0.70,
});

export function computeReward({ outcome, test_passed, duration_ms, cost_usd,
  max_expected_duration_ms = 120_000, max_expected_cost_usd = 0.50 }) {
  const OUTCOME_SCORE = { success: 1.0, partial: 0.5, failure: 0.0, timeout: 0.0, refused: 0.1 };
  const outcome_score = OUTCOME_SCORE[outcome] ?? 0.0;
  const test_score    = test_passed === true ? 1.0 : test_passed === false ? 0.0 : outcome_score;
  const cost_score    = 1.0 - Math.min(cost_usd / max_expected_cost_usd, 1.0);
  const dur_score     = 1.0 - Math.min(duration_ms / max_expected_duration_ms, 1.0);
  return 0.50*outcome_score + 0.30*test_score + 0.10*cost_score + 0.10*dur_score;
}

export function updateQValue(q_old, reward, alpha = 0.1) {
  return q_old + alpha * (reward - q_old);  // EMA; same formula as MemRL with gamma=0
}
```

### Key Surprising Findings

1. **No production system explicitly tracks delegation outcomes in a typed schema.** All production memory systems (Mem0, Letta, CrewAI, MemOS) store free-text memories with LLM-extracted metadata. Metis fills an open gap.

2. **MemRL's "Q-learning" with gamma=0 is just EMA.** The complexity in MemRL is the Python storage layer, not the math. `new_q = (1-α)*old_q + α*reward` is the entire update rule.

3. **OTel GenAI conventions are the de facto field naming standard.** Using `gen_ai.provider.name`, `gen_ai.request.model`, `gen_ai.usage.input_tokens`, `error.type` enables future integration with LangSmith/Phoenix/Datadog for free.

4. **`files_touched` is the highest-value field for routing precision.** Path-locality retrieval ("what happened last time we touched `src/api/auth.ts`?") is more precise than semantic task similarity. This is the `reflect()` operation's secret weapon.

5. **Store the embedding source string alongside the vector.** Embed `task_description + task_type + language`. Store the source string too — enables re-embedding on model upgrade without losing records.

### Sources
- [MemRL arXiv:2601.03192](https://arxiv.org/abs/2601.03192)
- [Hindsight arXiv:2512.12818](https://arxiv.org/abs/2512.12818)
- [OTel GenAI Agent Spans](https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-agent-spans/)
- [AIDev Task Stratification arXiv:2602.08915](https://arxiv.org/html/2602.08915v1)
- [BaRP — LLM Router via Bandit Feedback arXiv:2510.07429](https://arxiv.org/html/2510.07429v1)
- [CLEAR Framework arXiv:2511.14136](https://arxiv.org/html/2511.14136v1)
- [GitHub Copilot Agentic Memory Blog](https://github.blog/ai-and-ml/github-copilot/building-an-agentic-memory-system-for-github-copilot/)
- [CrewAI Memory Concepts](https://docs.crewai.com/en/concepts/memory)

---

## Open Question 2: Hindsight — `vectorize-io/hindsight` vs. Custom Four-Network Implementation

### What vectorize-io/hindsight Actually Is

**It is exactly the library described in the foundation doc** — a production implementation of the four-network "Hindsight is 20/20" memory architecture from arXiv paper [2512.12818](https://arxiv.org/abs/2512.12818). Terminology mapping:

| Foundation doc framing | Paper/library name | Definition |
|---|---|---|
| World facts | **World (𝒲)** | Objective facts about the external world, independent of agent perspective |
| Agent experiences | **Experience (ℬ)** | Biographical information about the agent itself, written first-person |
| Entity summaries | **Observation (𝒮)** | Preference-neutral summaries of entities synthesized from multiple underlying facts |
| Evolving beliefs | **Opinion (𝒪)** | Subjective judgments with confidence scores and timestamps that update as evidence arrives |

The three operations (`retain`, `recall`, `reflect`) are implemented verbatim and match the paper's TEMPR and CARA components. **13,065 stars, 749 forks, MIT license, last commit 2026-05-11 (today).** Active daily development with Fortune 500 enterprise deployments.

### Language/Runtime — The Critical Constraint

The architecture has two tiers:

**Server (Python only — not embeddable from Node.js):**
The Hindsight daemon (`hindsight-api`) is a pure Python 3.11+ FastAPI application backed by PostgreSQL with pgvector. Dependency footprint: `asyncpg`, `pgvector`, `sqlalchemy`, `alembic`, `langchain-text-splitters`, `sentence-transformers`, `torch`, `litellm`, OpenTelemetry, AWS boto3, and 40+ more packages. Multi-hundred-MB Python service.

**Node.js client (`@vectorize-io/hindsight-client` v0.6.1):**
A thin TypeScript HTTP client with zero production dependencies (pure `fetch` calls). Ships as both CJS and ESM. API surface:
```typescript
client.retain(bankId, content, { timestamp?, context?, metadata?, async? })
client.recall(bankId, query, { types?, maxTokens?, budget? })
client.reflect(bankId, prompt, { budget?, context? })
```

**Embedded Node.js option (`@vectorize-io/hindsight-all` v0.6.1):**
Spawns the Python daemon as a child process via `uvx`. Requires Node.js ≥ 22, `uv`/`uvx` on PATH, Python 3.11+, and PostgreSQL. Daemon startup timeout: **30 seconds**.

### Fit Assessment for Metis

**Architecturally correct, operationally wrong for a Claude Code plugin.**

Claude Code plugins run as lightweight `.mjs` processes. Hindsight requires Python 3.11+, uv, PostgreSQL, and a persistent HTTP server on port 8888 with a 30-second startup. That is the wrong operational profile for a plugin that should load in milliseconds with no managed infrastructure.

The client-only option (`@vectorize-io/hindsight-client` pointing to Hindsight Cloud at `https://ui.hindsight.vectorize.io`) removes the Python dependency but adds cloud dependency, network latency on every `retain`/`recall`, and an external account requirement.

### No Node.js-Native Equivalent Exists

No existing Node.js library implements the Hindsight four-network design natively. The pattern is research-novel (paper December 2024) and the only implementation is the Python-backed vectorize-io/hindsight.

### Custom Implementation Feasibility

**Estimate: 350–500 lines of .mjs. Storage backend: `better-sqlite3` + `sqlite-vec`.**

Rationale: zero infrastructure (no Postgres, no Redis, no Docker), native Node.js bindings, `sqlite-vec` adds cosine similarity search directly in SQL, single `.sqlite` file per project, portable and inspectable.

Schema sketch:
```sql
-- Four network tables
CREATE TABLE world_facts (id, content TEXT, entities JSON, embedding BLOB, created_at);
CREATE TABLE experiences (id, task_id, outcome TEXT, provider, duration_ms, embedding BLOB, created_at);
CREATE TABLE entity_summaries (id, entity_name TEXT UNIQUE, summary TEXT, embedding BLOB, updated_at);
CREATE TABLE evolving_beliefs (id, subject TEXT, belief TEXT, confidence REAL, embedding BLOB, updated_at);

-- sqlite-vec virtual tables for ANN search
CREATE VIRTUAL TABLE world_vec USING vec0(embedding float[384]);
CREATE VIRTUAL TABLE experience_vec USING vec0(embedding float[384]);
```

Operations breakdown:
- `retain(outcome)` — classify into network, upsert with embeddings — ~100 lines
- `recall(context)` — embed query, cosine search across four tables, merge with token budget — ~80 lines
- `reflect(entities)` — pull entity summaries + beliefs, format routing synthesis prompt — ~60 lines
- Schema init + embedding utility — ~100 lines

**Embedding strategy:** `@xenova/transformers` running `all-MiniLM-L6-v2` in-process (~384 dimensions, ~45MB model download once, no API key, no server). Alternatively delegate to the provider already in use (simpler, no local model).

**Total added dependencies:** `better-sqlite3` + `sqlite-vec` + optionally `@xenova/transformers`. No servers, no Python, no cloud accounts.

### Trade-off Table

| Dimension | `vectorize-io/hindsight` | Custom .mjs |
|---|---|---|
| Architecture fit | Perfect — exact four-network design | Tailored to Metis's 3 operations only |
| Operational overhead | High — Python 3.11+, uv, Postgres | None — single SQLite file, Node.js only |
| Startup latency | 20–30 seconds (daemon boot) | <100ms (SQLite open) |
| Dependency risk | ~50 Python packages + version drift | 2–3 npm packages, actively maintained |
| Feature completeness | State-of-the-art (91% LongMemEval) | Sufficient for Metis |
| Maintenance burden | Zero (upstream) | You own it |
| Cloud option | Yes, via Hindsight Cloud API | N/A |
| Plugin UX | Requires Python/uv OR cloud signup | Transparent — `npm install` and go |

### Recommendation

**Build custom. Use `better-sqlite3` + `sqlite-vec`.**

The library is architecturally ideal but operationally wrong for a plugin. The four-network design is well-specified in the paper and Metis only needs three operations — a simpler scope than the full Hindsight featureset. The custom build fits in ~400 lines with two stable npm dependencies.

Optional future path: offer Hindsight Cloud as a backend adapter (`METIS_MEMORY_BACKEND=hindsight-cloud`) once the default SQLite implementation ships.

### Sources
- [vectorize-io/hindsight GitHub](https://github.com/vectorize-io/hindsight)
- [arXiv 2512.12818 — Hindsight is 20/20](https://arxiv.org/abs/2512.12818)
- [@vectorize-io/hindsight-client on npm](https://www.npmjs.com/package/@vectorize-io/hindsight-client)
- [@vectorize-io/hindsight-all on npm](https://www.npmjs.com/package/@vectorize-io/hindsight-all)
- [sqlite-vec JS usage guide](https://alexgarcia.xyz/sqlite-vec/js.html)
- [better-sqlite3 GitHub](https://github.com/WiseLibs/better-sqlite3)

---

## Open Question 3: MemRL — `MemTensor/MemRL` vs. Custom Q-Value Scoring

### What MemTensor/MemRL Actually Is

**Language:** Pure Python. `pyproject.toml` declares `requires-python = ">=3.9"`. No JavaScript, TypeScript, or .mjs files. Published January 2026 alongside arXiv paper [2601.03192](https://arxiv.org/abs/2601.03192). **112 stars, 9 forks, MIT license, last push 2026-05-02.** Research artifact, not a production library.

**What it actually implements** (from `memrl/service/value_driven.py`):

Phase 1 — semantic: `QueryRetriever` calls `MemOS.search_score()`, a vector cosine search backed by Qdrant, filtered by similarity threshold `tau=0.35`, returning top-K candidates.

Phase 2 — Q-value selection: `ValueAwareSelector.select()` sorts candidates by stored `q_value`, then applies ε-greedy (`ε=0.1`) to pick the final memory.

**Q-value update rule:**
```python
target = reward + gamma * next_max_q   # gamma=0.0 by default
new_q = (1.0 - alpha) * old_q + alpha * target
# With gamma=0.0, this collapses to: new_q = (1-α)*old_q + α*reward
```
With `gamma=0.0` (the default), the "Q-learning" is mathematically identical to an **exponential moving average of rewards**. The complexity in their system is entirely in the MemOS storage layer (MySQL + Qdrant + SQLAlchemy), not the update formula.

**Dependency stack:** `torch==2.8.0`, `transformers==4.56.0`, `mem0ai==1.0.1`, `memoryos==1.0.0`, `qdrant-client`, `alfworld`, `browsergym`, `tensorboard`. The core `MemOS` class is a Python-only library.

### Usable from Node.js?

**No.** Cannot be called from Node.js without spawning a Python subprocess and standing up a Qdrant+MySQL backend. Both violate Metis's millisecond-latency and local-only constraints.

### The Actual Math Is Trivial — Implement Custom

With `gamma=0.0`, MemRL's Q-value update is just:
```
q_new = (1 - α) * q_old + α * reward
```

The entire "learning which provider works" capability reduces to this one-liner per `(task_category, provider)` pair. No RL infrastructure needed.

### Embedding Strategy for Phase 1 (Node.js, Local, Fast)

| Package | Model | Per-query latency | Offline |
|---|---|---|---|
| `fastembed` (npm v2.1.0) | BGEBaseEN (BAAI/bge-base-en-v1.5) | ~5–15ms | Yes (cached) |
| `@huggingface/transformers` v4.2.0 | all-MiniLM-L6-v2 | ~5–20ms | Yes |
| `@xenova/transformers` v2.17.2 | all-MiniLM-L6-v2 | ~10–30ms | Yes |

**`fastembed` (npm) is the best choice:** uses `onnxruntime-node` (native binary, fastest path) + Rust-compiled tokenizers. Default model (`BGEBaseEN`) tops MTEB leaderboard for retrieval. ESM-native (`.mjs`-compatible). ~2s model download on first run, cached thereafter. Batch embeddings via async generators.

### Two-Phase Implementation Sketch (~200 lines .mjs)

```javascript
// memrl.mjs — two-phase retrieval with EMA Q-values
import { FlagEmbedding, EmbeddingModel } from 'fastembed';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const STORE_PATH = './memrl_store.json';
const SIM_THRESHOLD = 0.35;
const TOP_K = 5;
const ALPHA = 0.1;   // EMA learning rate (same as MemRL default)
const EPSILON = 0.1; // ε-greedy exploration
const Q_INIT = 0.5;  // optimistic initialization

// Store shape: { entries: [{ id, taskSummary, provider, taskCategory, embedding, qValue, visits, successes, lastUpdated }] }

function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i]*b[i]; na += a[i]*a[i]; nb += b[i]*b[i]; }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-8);
}

// Phase 1: filter by semantic similarity
async function phase1(taskDescription, store) {
  const embedder = await FlagEmbedding.init({ model: EmbeddingModel.BGEBaseEN });
  const gen = embedder.embed([taskDescription], 1);
  let qVec;
  for await (const batch of gen) qVec = Array.from(batch[0]);

  return store.entries
    .map(e => ({ ...e, similarity: cosine(qVec, e.embedding) }))
    .filter(e => e.similarity >= SIM_THRESHOLD)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, TOP_K);
}

// Phase 2: ε-greedy Q-value selection
function phase2(candidates) {
  if (!candidates.length) return null;
  const ranked = [...candidates].sort((a, b) => (b.qValue ?? Q_INIT) - (a.qValue ?? Q_INIT));
  return Math.random() < EPSILON
    ? ranked[Math.floor(Math.random() * ranked.length)]
    : ranked[0];
}

export async function retrieve(taskDescription) {
  const store = JSON.parse(existsSync(STORE_PATH) ? readFileSync(STORE_PATH, 'utf8') : '{"entries":[]}');
  const selected = phase2(await phase1(taskDescription, store));
  return selected ? { provider: selected.provider, entry: selected } : null;
}

export function updateQValue(entryId, reward) {
  const store = JSON.parse(readFileSync(STORE_PATH, 'utf8'));
  const e = store.entries.find(x => x.id === entryId);
  if (!e) return;
  e.visits += 1;
  if (reward > 0) e.successes += 1;
  e.qValue = (1 - ALPHA) * (e.qValue ?? Q_INIT) + ALPHA * reward;  // EMA (= MemRL with gamma=0)
  e.lastUpdated = new Date().toISOString();
  writeFileSync(STORE_PATH, JSON.stringify(store, null, 2));
}
```

Linear Phase 1 scan: <10ms for up to ~5,000 entries (384-dim cosine ~1ms/100 entries). Above ~5,000, upgrade to `usearch` (npm, WebAssembly ANN, no native build issues).

### Even Simpler: Pure Bandit (~40 lines, Zero Dependencies)

If task categories are known in advance, skip Phase 1 entirely. Thompson Sampling per `(category, provider)`:

```javascript
// bandits.mjs — Thompson Sampling, no dependencies
const state = {};  // { "refactor:codex": { alpha: 1, beta: 1 } }

export function selectProvider(category, providers) {
  return providers
    .map(p => { const {alpha=1,beta=1} = state[`${category}:${p}`] ?? {}; return {p, score: sampleBeta(alpha, beta)}; })
    .sort((a,b) => b.score - a.score)[0].p;
}

export function update(category, provider, success) {
  const key = `${category}:${provider}`;
  if (!state[key]) state[key] = { alpha: 1, beta: 1 };
  success ? state[key].alpha++ : state[key].beta++;
}
```

A 2025 comparative study found Thompson Sampling requires ~26% fewer queries than ε-greedy to reach 70% success rate. The RSCB-MC paper (arXiv:2604.27283) confirms this two-phase architecture achieves **p95 decision latency of 331 microseconds** without RL infrastructure.

### Recommendation

**Do not use MemTensor/MemRL.** Python-only, Qdrant+MySQL backend, no Node.js path. The actual math it runs is a one-liner EMA.

**Ship in two phases:**
1. **Phase 1 (immediate):** Pure bandit — 40-line Thompson Sampling, zero deps. Delivers "learns which provider works" per task category with no embeddings.
2. **Phase 2 (when needed):** Add `fastembed` + the two-phase semantic + Q-value sketch for retrieval of successful task *patterns*, not just per-category statistics.

### Sources
- [MemTensor/MemRL GitHub](https://github.com/MemTensor/MemRL)
- [arXiv:2601.03192 — MemRL paper](https://arxiv.org/abs/2601.03192)
- [arXiv:2604.27283 — RSCB-MC: Risk-Sensitive Contextual Bandits for Memory Retrieval](https://arxiv.org/html/2604.27283)
- [fastembed npm v2.1.0](https://www.npmjs.com/package/fastembed)
- [fastembed-js GitHub](https://github.com/Anush008/fastembed-js)
- [Thompson Sampling vs UCB 2025 comparative study](https://www.itm-conferences.org/articles/itmconf/abs/2025/09/itmconf_cseit2025_01029/itmconf_cseit2025_01029.html)

---

## Open Question 4: Mem0 — Drop-In Memory Layer vs. Custom Implementation

### What Mem0 Is

Mem0 is an open-source, intelligent memory layer for LLM applications. It extracts salient facts from conversations or structured input, deduplicates and consolidates them, and stores them in a dual backend: a vector database for semantic retrieval + SQLite for audit/change history. A graph backend (Neo4j or embedded Kuzu) is optionally added for relational/entity memory.

- **GitHub:** github.com/mem0ai/mem0 — Apache 2.0, fully free to self-host
- **Paper:** [arXiv:2504.19413](https://arxiv.org/abs/2504.19413) — 26% accuracy improvement over OpenAI memory, 91% lower p95 latency vs full-context, 90%+ token savings
- **Retrieval:** three parallel passes — semantic similarity (vector), keyword (BM25), entity matching — fused via RRF scoring

### Node.js SDK Status

**Package:** `npm install mem0ai` — released March 2025. Node.js 18+ required (20+ recommended).

Two entry points:
- `import { MemoryClient } from "mem0ai"` — cloud platform mode (requires `m0-` API key)
- `import { Memory } from "mem0ai/oss"` — fully local, self-hosted OSS mode

OSS SDK example:
```typescript
const memory = new Memory({
  llm: { provider: "openai", config: { model: "gpt-4o-mini", apiKey: "..." } },
  embedder: { provider: "ollama", config: { model: "nomic-embed-text", url: "http://localhost:11434" } },
  vectorStore: { provider: "memory" }, // in-process default
  historyDbPath: "~/.metis/mem0-history.db"
});

await memory.add(messages, {
  userId: "global",
  metadata: { provider: "anthropic", taskType: "code-review", success: true }
});

const results = await memory.search("code review tasks", {
  userId: "global",
  filters: { provider: "anthropic", success: true }
});
```

**Limitation:** TypeScript OSS docs are thinner than Python docs. Graph memory (Neo4j/Kuzu) appears Python-first with unclear TypeScript parity.

### "Supports Claude Code via `npx skills add`" — What This Actually Means

The phrase in the foundation doc is misleading. What exists: Mem0's Claude Code integration is a cloud MCP server at `mcp.mem0.ai/mcp` requiring a `m0-` cloud API key. It is **not** a `.mjs` Claude Code plugin — it's a cloud integration. There is no "Mem0 Claude Code skill" via `npx skills add`. This approach is irrelevant to Metis's local plugin architecture.

### Scoped Memory Mapping

Mem0's scope model (`user_id`, `agent_id`, `run_id`) maps onto Metis's three layers:

| Metis Scope | Mem0 Mapping |
|---|---|
| Global (`~/.claude/metis/`) | `userId: "global"` |
| Workspace | `userId: "workspace:<hash>"` + `agentId: "<workspace-path>"` |
| Repo (`.metis/` in repo) | `userId: "repo:<repo-name>"` + `agentId: "<git-remote>"` |

Caveat: this is an abuse of `userId`/`agentId` semantics, not native hierarchical scoping. Cross-scope rollup requires explicit multi-level queries in Metis code.

### Structured Outcome Records

Mem0's `add()` accepts messages plus a free-form `metadata` dict:
```json
{ "provider": "codex", "task_type": "refactor", "success": true, "latency_ms": 1240, "scope": "repo:metis" }
```

Retrieval with metadata filters works (operators: `eq`, `ne`, `gt`, `gte`, `lt`, `lte`, `in`, `nin`, `contains`, `AND`/`OR`/`NOT`). Qdrant gives full operator support; the in-memory default falls back to simple equality.

**Critical gap:** Mem0's `add()` passes messages through an LLM that *extracts* and *distills* the memory into natural language. For structured delegation records, this adds LLM call overhead and risks lossy transformation. Workaround: store structured fields in metadata, rely on metadata filters for routing rather than semantic search.

### Latency Profile

From Mem0's own paper benchmarks:
- **Search (retrieval only):** p50 = 148ms, p95 = 200ms
- **Full add + retrieval pipeline:** p50 = 710ms, p95 = 1.44s (includes LLM extraction call)
- Memory writes are async — fire-and-forget post-delegation does not block the user

### What Mem0 Does NOT Provide (Metis Gaps)

| Metis Need | Mem0 Status |
|---|---|
| Q-value / performance scoring per provider | Not present — build custom |
| MemRL reranking (outcome-weighted retrieval) | Not present — retrieval is semantic+keyword+entity fusion only |
| Provider routing based on historical win rates | Not present — Mem0 retrieves memories, does not recommend routing |
| Cross-scope memory inheritance | Not present — each scope isolated; multi-query logic needed |
| Atomic structured writes (no LLM distillation) | Not in standard `add()` path |
| Graph memory in Node.js OSS | Unclear — appears Python-only in OSS SDK |

### Alternatives Comparison

| System | Node.js SDK | Offline | Routing Logic | Verdict for Metis |
|---|---|---|---|---|
| **Mem0 OSS** | Yes (Mar 2025) | Yes (Ollama) | No — build it | Good storage/retrieval layer; you still build scoring |
| **Zep / Graphiti** | Yes (TypeScript) | Community Edition deprecated Apr 2025 | No | Best for temporal/relational; cloud-dependent main product |
| **Letta (MemGPT)** | Yes (`@letta-ai/letta-client`) | Self-hostable | No | Full agent framework — overkill for a plugin |
| **Custom SQLite** | N/A | Fully local | Yes — you write it | Maximum control, zero overhead |

### Recommended Architecture Split

```
Metis plugin
├── mem0ai/oss (Memory)          ← storage, semantic search, metadata filtering
│   ├── in-memory vector store   ← fast, zero external deps
│   ├── SQLite history           ← audit trail, ~/.metis/history.db
│   └── Ollama embeddings        ← fully offline
└── Metis scoring engine (custom)
    ├── Q-value table per (scope, provider, task_type)
    ├── MemRL reranker (combine mem0 score + historical win rate)
    └── Cross-scope query orchestrator
```

### Recommendation

**Use Mem0 OSS selectively as the storage/retrieval layer, not as a drop-in.** It gives you hybrid semantic+keyword retrieval, metadata filtering, and an audit trail for free. You still build Q-value scoring, provider routing, and cross-scope rollup.

**Skip Mem0 if:** startup latency is critical (Ollama embedding model cold-start adds seconds), or you prefer zero external dependencies (a 200-line custom `better-sqlite3` + `sqlite-vec` module covers the same ground with more control and less surface area). The Node.js SDK is new (March 2025), docs are thin, and graph features are Python-first.

**Do not** use the Mem0 Claude Code MCP integration — it is cloud-only and incompatible with Metis's `.mjs` plugin architecture.

### Sources
- [github.com/mem0ai/mem0](https://github.com/mem0ai/mem0)
- [arXiv:2504.19413 — Mem0 architecture paper](https://arxiv.org/abs/2504.19413)
- [docs.mem0.ai/open-source/node-quickstart](https://docs.mem0.ai/open-source/node-quickstart)
- [docs.mem0.ai/integrations/claude-code](https://docs.mem0.ai/integrations/claude-code)
- [docs.mem0.ai/open-source/features/metadata-filtering](https://docs.mem0.ai/open-source/features/metadata-filtering)
- [docs.mem0.ai/components/embedders/models/ollama](https://docs.mem0.ai/components/embedders/models/ollama)
- [mem0.ai/pricing](https://mem0.ai/pricing)
- [Mem0 vs Zep vs LangMem comparison 2026](https://dev.to/anajuliabit/mem0-vs-zep-vs-langmem-vs-memoclaw-ai-agent-memory-comparison-2026-1l1k)
