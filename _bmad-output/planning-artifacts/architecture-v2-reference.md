---
stepsCompleted: [1, 2]
inputDocuments:
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/research/nlm-metis-resources-findings-2026-05-15.md
  - _bmad-output/planning-artifacts/research/technical-metis-plugin-memory-architecture-research-2026-05-11.md
workflowType: 'architecture'
project_name: 'metis'
user_name: 'Somyung'
date: '2026-05-15'
---

# Architecture Decision Document — Metis

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

---

## Project Context Analysis

### Requirements Overview

**Functional Requirements:**
43+ FRs across 8 capability clusters: task delegation, plan confirmation & review,
routing intelligence, compounding memory, introspection & recovery, security &
credential protection, distribution & configuration, observability & telemetry.
Plus FR-CRITIC-1 (Critic sub-agent, standalone). Every FR maps to at least one of
11 acceptance criteria — all are hard release gates.

**Non-Functional Requirements:**
- Performance: routing decision ≤50ms p99; plan generation ≤20s cloud / ≤30s
  Ollama; reflect() ≤2s p95 (≤1000 commits); token injection budget ≤1,900 tokens
- Security: zero credential leakage across 4 protected surfaces; AC-1 and
  AC-CRITIC-1 are ship-gates
- Reliability: atomic schema migrations; per-network failure isolation; SIGKILL
  recovery via SQLite WAL; single-instance PID lock; ordered startup recovery
- Storage: total ~/.metis/ ≤500MB at 1 year typical use; routing state ≤50MB at
  10k entries
- Integration: Node.js ≥18; CommonJS; Claude Code plugin boundary (no persistent
  background processes); cross-platform path handling

**Scale & Complexity:**
- Primary domain: Developer tool / Claude Code plugin / backend (CLI only, no UI in v1)
- Complexity level: High — novel RL routing + four-network memory + multi-provider
  delegation + plugin boundary constraints
- Estimated architectural components: ~12 primary components
- Solo developer, ~8 calendar weeks (~40 engineer-days), greenfield

### Technical Constraints & Dependencies

- **Plugin boundary (hard):** No persistent background processes or daemon.
  All deferred signals (T2, T3) resolve at next SessionStart or /metis:status.
  Every session starts with zero in-memory state — this is the primary operational
  mode, not a footnote.
- **T2 detection window:** T2 signals (PR inclusion, 7-day TTL) are detected via
  SessionStart git-cursor sync (reflect()). If the user goes 7+ days without a
  Claude Code session, T2 signals are permanently lost. This is an accepted
  correctness loss — the architecture must state this tolerance explicitly.
- **Native-dialect-per-provider (hard):** Claude via Agent tool (teammate
  subagent), Codex via Agent tool OR spawn (TS-1.3 open — must resolve Sprint 1,
  not Sprint 2), Copilot CLI via child_process.spawn, Ollama via fetch(). No
  lowest-common-denominator wrapper — architecturally prohibited.
- **Teammate subagent model (hard):** All cross-provider delegations use
  teammate subagent (fresh context, native tool surface). Fork is reserved for
  same-model Claude sub-delegations only.
- **All-custom-SQLite memory (hard):** All four memory networks implemented in
  custom SQLite (better-sqlite3). No agentmemory MCP or external memory service.
  One file (metis.db), one process boundary, one failure mode. This eliminates the
  cross-backend synchronization contract entirely.
- **FTS5 retrieval in v1 (not vector similarity):** At ~240 observations, SQLite
  FTS5 (keyword match + BM25 scoring, no extension required) is sufficient. sqlite-vec
  is deferred to v1.1. Embedding column added as NULLABLE BLOB from day one so
  v1.1 upgrade is additive, not a migration.
- **Migration runner is v1 must-have:** better-sqlite3 + PRAGMA user_version +
  numbered SQL files (001_init.sql, etc.). Owned in v1 — not deferred.
- **ProviderAdapter interface with AbortSignal (hard):** Both generate_plan AND
  execute phases must accept AbortSignal as a required parameter. Cancellation
  cannot be bolted on after the interface is defined. For Copilot CLI (spawn path):
  pass { signal } to child_process.spawn (Node 15.4+ feature). For Ollama (fetch
  path): use native Node 18 fetch with { signal } — do NOT use node-fetch < v3.
- **Injectable RNG for Thompson Sampling (architectural constraint):** The Beta
  distribution sampler must accept an injectable RNG. If betaSample() calls
  Math.random() internally and is not injectable, AC-2 (routing improves over
  200-250 delegations) is non-deterministic and non-automatable.
- **CommonJS module system:** Node.js ≥18, TypeScript ES2022/CommonJS. ESM
  interop with Claude Code plugin loader unverified in v1. better-sqlite3 ships
  CommonJS — no ESM/CJS compatibility risk.
- **SQLite WAL mode:** Required for SIGKILL-safe state persistence (NFR-R5).
  Register process.on('exit', () => db.close()) — better-sqlite3 flushes WAL on
  close. Set db.pragma('busy_timeout = 3000') immediately after open.
- **Zod as schema source of truth:** Config, plan schema, and invocations schema
  all Zod-first; JSON Schema generated for tooling ($schema autocomplete).
- **JSONC config format:** Unified with Claude Code ecosystem conventions.

### Technical Constraints Confirmed Resolved

- **No agentmemory MCP:** Decision confirmed after party-mode review. External
  MCP service introduced: (1) undefined synchronization contract between two
  authoritative stores, (2) process boundary with no degradation mode, (3) CommonJS/
  ESM compatibility risk. All eliminated by all-SQLite path.
- **No sqlite-vec in v1:** Native binary dependency (.dylib/.so) with platform-
  specific prebuilt availability risks. FTS5 (built into SQLite, zero dependencies)
  is sufficient at v1 scale. sqlite-vec added as optional dependency for v1.1
  activation.

### Sprint-Blocking Tech Spec Dependency DAG

11 open specs gate Sprint 2. Full dependency ordering (not just the one pair noted
in PRD):

```
TS-1.3   (Codex integration)        → must resolve Sprint 1 (gates fallback chain design)
TS-1.4   (failure_class + signal_class)  → must precede TS-REWARD-1
TS-1.10  (Plan schema + state machine)  → must precede TS-1.16
TS-1.11  (annotation pattern registry) → must precede TS-COMPACT-1
TS-1.15  (memory write-path)           → must precede TS-1.16
TS-1.16  (cancellation + reconciliation) — depends on TS-1.10 AND TS-1.15
TS-REFLECT-1 (reflect() contract)       → must precede TS-COMPACT-1
TS-COMPACT-1 (PreCompact hook)          — depends on TS-1.11 AND TS-REFLECT-1
TS-REWARD-1  (t3_confidence)            — depends on TS-1.4
TS-1.13  (belief-strength scoring)      — depends on TS-1.4 (reads signal_class)
TS-SECURITY-1 (Critic side-query)       — independent, but gates AC-CRITIC-1
```

Parallelizable in Sprint 1: TS-1.3, TS-1.4, TS-1.10, TS-1.11, TS-1.15, TS-REFLECT-1, TS-SECURITY-1.
Must wait: TS-1.16 (after TS-1.10 + TS-1.15), TS-REWARD-1 (after TS-1.4), TS-1.13 (after TS-1.4), TS-COMPACT-1 (after TS-1.11 + TS-REFLECT-1).

### Cross-Cutting Concerns

1. **RL signal integrity** — Three layers enforce correct bandit training: (1)
   failure_class taxonomy (14 values, distinguishes platform/capability/user-veto
   failures), (2) signal_class decomposition (fault/preference/correction/aborted/
   ambiguity — prevents training poisoning), (3) t3_confidence probabilistic
   attenuation (6 failure modes for T3 git attribution, excludes signals below 0.4).
   Must be enforced architecturally at write time. Note: a Critic block (TS-SECURITY-1)
   must map to a "security_block" failure_class that does NOT propagate to provider
   Q-value scoring — credential exposure in a plan is a task formulation failure,
   not a provider quality signal.

2. **Routing rationale as first-class output contract** — The Claude Code
   tool-response payload must carry structured rationale (provider selected, current
   arm weights, confidence interval, last T3 signal that influenced the prior) as a
   first-class output, not a logging afterthought. AC-3 (trust as observable
   behavior) is only satisfiable if the developer can inspect routing decisions.
   Manual overrides on invisible routing create unattributed state changes that
   poison the Thompson Sampling posterior. This is a data integrity concern, not
   a UX concern.

3. **Security boundaries at delegation** — Two-layer credential blocklist (Layer 1
   at task intake, Layer 2 Critic sub-agent pre-forward, credential exposure only).
   Unified pattern registry shared between plan annotation and credential scanning.
   The Critic (FR-CRITIC-1) requires a CriticHarness fixture interface (labeled-corpus
   loader + confusion-matrix scorer) — architecturally distinct from AC-1's
   presence-assertion harness. Must be named in TS-SECURITY-1.

4. **Session lifecycle orchestration** — reflect() at SessionStart (git cursor
   advance, T2/T3 detection, four-network population); PreCompact hook for memory
   re-injection (context window survival); ordered startup recovery (stale-lock
   heal → orphan reconciliation → reflect()). All three are sprint-blocking.
   Startup sequence must be fully async (Promise chain) to accommodate any future
   ESM-only dependencies.

5. **Cancellation safety** — Entire /metis:do pipeline designed for cancellation:
   transactional/idempotent state mutations, cancellable provider calls (both
   generate_plan AND execute phases via AbortSignal), recorded-but-statistically-
   silent aborted terminal, orphaned-record lease reconciliation on startup.
   ProviderAdapter interface must type signal: AbortSignal as required from day one.

6. **Token budget allocation** — ≤1,900 token injection ceiling across four
   memory networks with named priority order (agent_experiences → entity_summaries
   → world_facts → evolving_beliefs). Token budget enforcement: loop over FTS5
   results, accumulate estimated token count (length / 4), break at budget.
   PreCompact re-injection reuses same allocator and priority order.

7. **Provider fault isolation** — Single provider failure must not cascade to
   delegation failure (fallback chain: Claude → Codex → Copilot CLI → Ollama).
   Single memory network write failure must not block other networks or abort
   delegation (NFR-R3: per-network 20ms timeout at routing-decision-time, timeout
   = skip not failure).

8. **project_path key stability** — Bandit arms are scoped by (project_path,
   task_type, provider). If the user moves their repo or uses a different mount
   point, bandit arms are silently orphaned and new arms start cold. The
   architecture must define what happens on project_path change — warn the user,
   offer to migrate, or silently start fresh. This is a data integrity issue that
   presents as a behavior regression.

9. **Unresolved evidence gaps (architectural wildcards)** — Four NLM queries were
   not retrieved and each blocks a named concern:
   - M-5 (circuit-breaker auto-disable) → blocks provider fault isolation tier design
   - M-7 (team memory threshold) → blocks shared bandit state design (if small-team
     persona is ever in scope)
   - M-10 (npm install adoption evidence) → blocks distribution NFR validation
   These must be commissioned before Sprint 2 scope is finalized.

### Key Architectural Priorities (Ranked by Differentiation)

Per competitive analysis (Copilot CLI v1.0.32 already ships multi-model routing):

1. **T3 signal fidelity is the primary differentiator** — per-repo bandit state
   initialized by T3 git-outcome signals is what Copilot cannot replicate.
   Getting T3 wrong means Metis is a slower version of what Copilot already ships
   for free. T3 signal capture and t3_confidence attenuation (TS-REWARD-1) are
   the highest-priority correctness requirements.

2. **Per-repo bandit state isolation** — arms scoped by project_path. This, plus
   T3, is the structural moat.

3. **evolving_beliefs is the most deferrable v1 network** — it has no T3 feedback
   path at launch. If sprint timeline is at risk, this network is the correct cut.

### Open Product Questions (Require Decision Before Sprint 2)

- **AC-2 timeline tension:** AC-2 requires 200-250 delegations. Starting dogfood
  at week 4 of an 8-week project yields ~5 delegations/day to reach 250 by week 12
  — past the v1 ship date. Either AC-2 is relabeled as a post-ship learning
  milestone, or a different acceptance criterion defines "learning works" within
  the 8-week window.
- **Q_INIT_PRIORS validation:** AIDev study base rates are population-level
  estimates. What happens when priors are wrong by 20% for this specific codebase?
  Does Thompson Sampling correct fast enough before the bandit locks in a
  suboptimal provider?
- **Week-4 sanity check trigger:** If signal volume is insufficient at week 4,
  the bandit cannot distinguish provider quality from noise and Q_INIT_PRIORS
  become load-bearing forever. Name the specific signal threshold that triggers
  the halt-and-diagnose decision.
