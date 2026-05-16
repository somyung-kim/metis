---
stepsCompleted: [step-01-init, step-02-discovery, step-02b-vision, step-02c-executive-summary, step-03-success, step-04-journeys, step-05-domain, step-06-innovation, step-07-project-type, step-08-scoping, step-09-functional, step-10-nonfunctional, step-11-polish, step-e-01-discovery, step-e-02-review, step-e-03-edit]
releaseMode: phased
inputDocuments:
  - metis-project-foundation.docx
  - _bmad-output/planning-artifacts/research/technical-metis-plugin-memory-architecture-research-2026-05-11.md
  - _bmad-output/planning-artifacts/research/nlm-metis-resources-findings-2026-05-15.md
workflowType: 'prd'
workflow: 'edit'
classification:
  projectType: developer_tool
  domain: general
  complexity: high
  projectContext: greenfield
lastEdited: '2026-05-15'
editHistory:
  - date: '2026-05-15'
    changes: 'Applied 30 NLM research findings: 4 sprint-blocking §TS-1 stubs (TS-COMPACT-1, TS-REFLECT-1, TS-SECURITY-1, TS-REWARD-1), t3_confidence probabilistic field, bandit calibration constraints, Critic plan-gate, 3 Risk Mitigation rows, Competitive Context (Copilot CLI v1.0.32, 4-pillar moat), native dialect constraint, co-evolution loop, NFR-P4/S1/M3 updates, NFR-INSTALL-1, slash command enhancements (why/status/forget/off-ramp), memory architecture hybrid path'
  - date: '2026-05-15'
    changes: 'Post-validation fix pass (validation-report-2026-05-15.md + 6-agent roundtable): registered FR-CRITIC-1 as canonical FR (Security & Credential Protection) scoped to credential/secret exposure only; registered AC-CRITIC-1 in Success Criteria (25/25 synthetic corpus, deterministic ground truth, holds every CI run); added FR8 pure-heuristic boundary clause; FR→AC matrix updated (AC-1 += FR-CRITIC-1, new AC-CRITIC-1 row); de-duplicated Plan-Confirmation prose to cross-reference canonical defs; aligned §TS-SECURITY-1 stub to credential-only scope + harness contract + deferred effort; de-leaked NFR-P4 (removed agentmemory MCP naming); Decision Log row 22 (scope rationale + solo-dev opportunity-cost trade); glossary + AC count updated'
---

# Product Requirements Document - Metis

**Author:** Somyung
**Date:** 2026-05-13

## Reader Guide

- **PM**: Executive Summary → Success Criteria (ACs) → Phased Development
- **Architect**: Domain Requirements → Innovation → §TS-1 stub table
- **UX Designer**: User Journeys → Developer Tool Requirements (plan card, /metis:status)
- **Engineer**: Functional Requirements → Non-Functional Requirements → §TS-1 stub table
- **Skeptic**: Competitive Context → Risk callouts in Phased Development → Innovation §Primary Technical Bet

## Executive Summary

### Thesis (one-pager)

Metis is a Claude Code plugin that routes each coding task to the right AI provider AND remembers what it learns about your repo. Compounding memory + multi-provider routing means each session starts where the last one ended — and the routing decisions sharpen with every use. This is possible *now* because Claude Code's plugin marketplace and Codex's plugin proof-of-concept made multi-provider delegation viable inside a single CLI session, while the rest of the AI tooling ecosystem still ships stateless agents that forget your repo every time.

### Overview

Metis is a Claude Code plugin that routes coding tasks to the right AI provider
and gets better at routing the longer you use it. The user-facing surface is a
small set of slash commands — `/metis:do` for delegation, introspection
(`/metis:why`, `/metis:status`, `/metis:help`), and one destructive verb
(`/metis:forget`, with `all`/`old` scopes) — plus Ctrl+C for graceful abort.
The commands stay out of the way.

**Target user:** Developers who already use Claude Code and run more than one AI
model (cloud or local). Specifically: engineers who have felt the friction of
asking Claude to review code Claude wrote, or who waste time re-explaining project
context to every new AI session. Metis is built first for the solo developer or
small team that wants AI delegation to compound — not reset — with each use.

**The problem:** Two distinct failures make current AI agent workflows expensive:

1. **Self-review blindness.** Claude cannot objectively critique its own output.
   It sees what it intended to write, not what it actually wrote. A fresh model
   with no prior context catches what Claude misses.

2. **Session amnesia.** Every subagent starts from zero. No memory of past
   outcomes, no accumulated routing intelligence, no institutional knowledge of
   your codebase. Developers re-explain the same context, make the same routing
   guesses, and absorb the same mistakes — session after session.

Existing multi-agent tools address neither problem well: they require separate
CLIs, steep configuration, and hard migration paths. You leave Claude Code to use
them.

**Why multi-CLI orchestration matters (it's not just a feature surface — it's what makes the RL loop *interesting*):** A single-provider tool can only learn "how good is provider X across all tasks" — a one-dimensional signal. Metis observes preference *across* providers per task type per repo — a multi-dimensional signal that produces strictly richer learning. The four-network memory plus T1/T2/T3 reward signals only generate genuinely differentiating routing intelligence *because* there are multiple arms with distinct strengths on the same task in the same repo. Multi-CLI is the moat; routing the moat surface; memory the durable value behind it.

**How it works — one delegation:**

You type `/metis:do review this PR for performance regressions`. Metis checks its
routing memory: in your codebase, Go performance reviews have succeeded 3x more
often with Codex than with Claude — probably because your Go service layer is
outside Claude's strongest context. Metis delegates to Codex, injects the relevant
prior outcomes as context ("last time we reviewed this module, the bottleneck was
in the connection pool"), and records the result. If Codex times out, it falls
back to the next provider in the chain and notes the failure. The routing model
updates. Next time, it knows more.

After 50 delegations, Metis knows your codebase's failure patterns by task type
and provider. After 200, it routes with the confidence of a senior developer who
has worked this repo for months.

**Why now:** The Codex Claude Code plugin proved clean, lightweight delegation
inside Claude Code is viable. Investigation into every existing alternative
(Ruflo, Claude-Flow, Claude Squad, ccpm) confirmed none combines real subprocess
delegation with a functional memory layer. The technical foundations for Metis —
local-first SQLite storage, provider-agnostic delegation, Thompson Sampling bandit routing — are
fully designed and validated. No infrastructure required. No cloud account.
`npm install` and go.

### What Makes This Special

**The problem is not that AI agents are weak. It is that they are amnesiac.**
Metis solves self-review blindness via delegation (fresh perspective from a
different model) and session amnesia via compounding memory (routing that learns
from every outcome, scoped per repo).

Simplicity is the adoption mechanism — one core command (`/metis:do`) drives the
flow, with supporting commands (`/metis:why`, `/metis:status`, `/metis:help`,
`/metis:forget`) that introspect or recover without intruding. No configuration
required to start; defaults are sane and the JSONC config is optional. No new CLI
to learn. The memory layer is the durable value — because Metis's routing
intelligence is trained on *your* codebase's specific failure patterns, it cannot
be replicated by any general-purpose tool without accumulating the same per-repo
outcomes. That takes time and usage. Every delegation widens the lead.

*(Workspace-scoped memory partitioning is a v1.1 capability. v1 memory is per-repo;
workspace-scoped lock files and cross-workspace isolation arrive in v1.1.)*

**In scope for v1:**
- `/metis:do` — autonomous end-to-end delegation, the core flow
- `/metis:why`, `/metis:status`, `/metis:help` — introspection and discoverability surfaces (post-hoc routing explanation, cold-return state readout, the map)
- `/metis:forget` — single destructive concept (`all` = wipe this repo's learning; `old` = trim entries older than N days), confirmation + preview before destruction
- **Ctrl+C** — graceful in-process abort of a running `/metis:do` with deterministic startup reconciliation of any orphaned in-flight record (not a slash command — the input line is owned by the running delegation when abort is needed)
- Optional plan-confirmation gate with annotation, reject-and-reroute flow, on-ramp banner (safety net), and always-on footer-hint discoverability for the off-ramp setting
- Providers: Claude models, OpenAI Codex, GitHub Copilot CLI, Ollama
- Compounding memory: routing decisions reference prior session outcomes
- Thompson Sampling bandit routing: system learns which provider handles which task type best per repo
- Telemetry (`invocations` table) capturing decisions, failure classes, and risky flags — unblocks v1.1 off-ramp threshold prompt
- Claude Code as primary runtime

**Out of scope for v1:** UI/dashboard, manual provider selection, providers beyond
the four named, multi-user or team-shared memory, runtimes outside Claude Code.

**Explicit non-goals (not v1, not v2):** VS Code extension, JetBrains plugin, or any other IDE surface. Metis is a Claude Code plugin, not a multi-IDE product. The architecture's decoupling between provider logic and the command layer exists to support future *Claude Code surfaces* (other Anthropic-shipped clients), not to enable porting to other IDEs. A VS Code story is a separate PRD for a separate product.

## Glossary

| Term | Meaning |
|---|---|
| **AC-N** | Acceptance Criterion — measurable ship-gate that validates a thesis claim (AC-1 through AC-10, plus AC-CRITIC-1) |
| **FR-N** | Functional Requirement — a binding capability the product MUST have (FR1 through FR43 with sub-letters, plus FR-CRITIC-1) |
| **NFR-N** | Non-Functional Requirement — quality attribute (latency, security, reliability, etc.) |
| **§TS-1.N** | Companion Tech-Spec Stub — implementation detail deferred from PRD to a tech-spec document; some are sprint-blocking |
| **T1 / T2 / T3** | Three tiers of reward signal: T1 task completion (immediate), T2 PR inclusion (7-day TTL), T3 commit retention/reversion (async via reflect) |
| **failure_class** | 14-value enum classifying delegation outcomes (e.g. `provider_timeout`, `plan_rejected`, `plan_modified`, `aborted`); governs Q-update behavior |
| **signal_class** | Sibling field (`fault` / `preference` / `correction` / `aborted` / `ambiguity`) decomposing what a failure_class record means for learning. Prevents preference, correction, and aborted signals from poisoning the fault-trained bandit. |
| **reflect()** | Startup lifecycle function: advances cursor in metis_meta, runs T3 reversion detection over git history, populates memory networks |
| **Four-network memory** (Hindsight architecture) | Repo-scoped knowledge stored across four SQLite tables: `agent_experiences`, `world_facts`, `entity_summaries`, `evolving_beliefs`. The *architecture* of memory. |
| **Compounding memory** | The *behavior* the four-network architecture produces — every delegation makes the next one sharper |
| **Plan-confirmation** | Optional pre-execution gate where the routed provider produces a plan, Metis annotates it via heuristic scan, the user reviews and accepts/rejects before code is written |
| **Plan annotation** (heuristic scan) | Regex/AST scan over plan text via the unified pattern registry (shared with credential blocklist). Not LLM-as-judge. |
| **Two-layer blocklist** | Credential pattern registry — Layer 1 scans task descriptions before delegation (halt on match); Layer 2 scans injected context before forwarding (redact + structured event) |
| **Thompson Sampling bandit** | The specific routing algorithm — probabilistic sampling over (task_type, provider) arms with Q_INIT_PRIORS for cold-start |
| **Probabilistic routing model** | The conceptual abstraction — Thompson Sampling is one valid implementation |
| **On-ramp / off-ramp** | UX moments where Metis suggests enabling (on-ramp) or disabling (off-ramp) plan-confirmation based on observed outcomes |
| **`/metis:forget`** | The single v1 destructive command. Prompts `all` (wipe this repo's bandit state + memory networks) or `old` (trim records older than N days). Replaces the former separate `reset`/`prune` commands. |
| **Ctrl+C abort** | The v1 abort mechanism for a running `/metis:do` — in-process graceful cancellation (not a slash command, since the input line is owned by the running delegation when abort is needed). Pairs with deterministic startup reconciliation of orphaned in-flight records. |
| **Cancellation contract (§TS-1.16)** | The property that the entire `/metis:do` pipeline is built for safe interruption: transactional/idempotent state mutations, cancellable provider calls (both `generate_plan` and `execute`), a recorded-but-statistically-silent `aborted` terminal, lease-based orphan reconciliation. Load-bearing for NFR-R2/R3/R5. |
| **v1 / v1.1 / v2** | Phasing labels. v1 = MVP. v1.1 = next iteration informed by dogfood data. v2 = vision / long-term. |
| **AC-2 RL gate** | The 50-eligible-delegations threshold + 14-day git history + ≥1 PR — gates when bandit starts trusting posteriors enough to exploit. Distinct from off-ramp threshold (user-trust). |

*Terminology rule: use "Thompson Sampling bandit" when naming the algorithm; "probabilistic routing model" when discussing the conceptual layer. "RL routing" is retired as too broad.*

## Project Classification

- **Type:** Developer tool (Claude Code plugin, distributed via the Claude Code marketplace; clone+`install.sh` is the dev/fallback path)
- **Domain:** Developer productivity / AI tooling (no regulated industry compliance)
- **Complexity:** High — novel probabilistic routing + four-network memory architecture, multi-provider
  subprocess delegation, three-layer scoped memory (global / workspace / repo),
  Claude Code plugin boundary constraints
- **Context:** Greenfield

## Competitive Context

Anthropic builds the agentic platform (MCP, native agent loops, Claude Code).
Metis builds an opinionated senior-engineer workflow on top of it — not competing
with Anthropic's horizontal infrastructure, but dependent on and extending it.

**Risk:** If Anthropic ships native multi-model routing inside Claude Code, the
simplicity advantage of `/metis:do` collapses. The compounding memory layer
remains the only durable differentiator — because Anthropic's memory primitives
are general-purpose (Projects, context windows), while Metis's RL model is trained
on per-codebase, per-task-type outcomes. General-purpose memory cannot replicate
codebase-specific routing intelligence without per-codebase training data. That
data only exists inside Metis.

**The RL memory layer is the business, not a feature.** Simplicity is what gets
developers to install it. Memory is what makes them stay.

**Live competitive precedent — GitHub Copilot CLI v1.0.32:** Copilot CLI now ships native multi-model routing (model selection per task type). This is a direct signal that the routing problem is real and that the market will move to multi-model workflows. Metis's differentiation is not routing itself — it is the T3 git-outcome signal (which Copilot cannot observe without a local agent), the per-repo bandit state, and the four-network compounding memory. The Copilot CLI release validates the thesis and raises the implementation bar simultaneously.

**Local routing scope — explicit boundary:** `code_review`, `multi_file_analysis`, and `architectural_decision` task types are NOT local-suitable in v1. These require context breadth that local models structurally cannot match. Routing these to Ollama is an antipattern; Q_INIT_PRIORS for Ollama on these task types start LOW (see Domain Requirements §Bandit calibration constraints). This is not a v1 limitation to be fixed — it is a correct scope decision.

**Four-pillar moat:** Metis's durable differentiation rests on four compounding factors: (1) **Model-Harness-Fit discipline** — each provider is invoked via its native interaction pattern (Agent tool for Claude, spawn for Copilot CLI, HTTP for Ollama), not a lowest-common-denominator wrapper; (2) **co-evolution feedback loop** — the bandit and memory layer improve together as the developer uses the tool, creating compounding value that a new entrant cannot replicate without data; (3) **citation-discipline per provider** — each provider's outputs are attributed, scored, and tracked separately, so the system learns which provider excels at which task class in this specific codebase; (4) **organism pattern** — Metis treats the codebase as a living entity whose entities, beliefs, and patterns evolve, not as a static context blob.

---

## Success Criteria

### User Success

**North star:** A developer types `/metis:do` on day one and again in week four —
without consulting docs, without debugging routing, without being prompted —
because the results are observably better.

- **Autonomous delegation:** `/metis:do` completes without mid-flight user
  intervention in ≥95% of invocations. *Duration is not a criterion* — a
  10-minute delegation that completes without interruption passes; a 30-second
  delegation that asks a clarifying question fails. Long-running delegations
  complete synchronously within the session (no background processes — see
  Domain Requirements §Runtime Contracts and FR4); a delegation a user no longer
  wants to wait for is cancelled with Ctrl+C (graceful in-process abort), not
  backgrounded.

- **Visible routing decisions:** Every delegation surfaces which provider was
  selected and why ("routing to Codex — 3 prior Go reviews succeeded vs. 1 for
  Claude in this repo"). Routing rationale is always visible; learning is never
  invisible.

- **Cumulative routing intelligence:** Beyond per-invocation rationale, Metis
  surfaces a running view of routing confidence: "Over the last 20 invocations,
  Codex handled Go reviews 85% of the time (up from 60% last week)." Routing
  confidence below a minimum observation threshold (50 outcomes per arm per task
  type) is surfaced as "still learning" — not presented as a confident signal.

- **No silent failures:** Every failed delegation — including full fallback chain
  exhaustion — surfaces a clear error with failure reason and which providers were
  attempted. Error surfacing rate = 100%.

- **Trust as observable behavior:** Somyung invokes `/metis:do` and proceeds with
  the delegated result — without subsequently validating the provider choice,
  checking memory state, or consulting documentation — in ≥90% of invocations
  across any 2-week window. If routing requires active debugging to trust, the
  simplicity promise is broken.

- **Retained use:** Developer continues using `/metis:do` after week one without
  external prompting. Continued use after observing routing rationale is the
  primary proxy for "it's actually getting smarter."

### Business Success

Three ordered claims, each a prerequisite for the next:

**1. It works for the builder.**
Somyung uses it daily on the Metis repo. If the builder doesn't trust it, no one
will. Daily use on a real project is the floor.

**2. The Thompson Sampling bandit routing demonstrably improves over time.**
Measured via a multi-tier git-observable signal — the same framework the field
is converging on for real-world agent evaluation:

| Tier | Lag | Signal | Weight |
|---|---|---|---|
| 1 — Completion | Instant | Delegation completed without error | 30% |
| 2 — PR inclusion | 1–7 days | Output committed to a branch or PR | 30% |
| 3 — Retention | 7–14 days | Code merged unchanged / merged with minor edits (<30% lines changed) / reverted or replaced / followed by a fix commit touching same lines | 40% |

Composite reward = `(T1 × 0.3) + (T2 × 0.3) + (T3 × 0.4)`

Tier 3 signals are deferred — recorded at delegation time, updated asynchronously
when git history is checked at next startup or on `/metis:status`. This is the
`reflect()` operation running post-hoc, not inline.

*Gate:* Composite reward score for invocations 200–250 is ≥15% higher (absolute)
than invocations 1–50, within the same repo. P-value ≤0.05. Mid-point diagnostic
at invocation 100: if routing entropy is unchanged, halt and diagnose before
continuing to 250.

**3. Memory compounds, not just accumulates.**
Routing entropy — the distribution of provider selections per task type —
decreases ≥20% between Week 1 and Week 4 for any repo with ≥50 invocations.
A bandit routing uniformly across providers is not learning.

**Expansion note (post-MVP):** Memory is repo-scoped at MVP. A new repo does not
inherit learned Q-values but does inherit Q_INIT_PRIORS — empirical base rates by
task type derived from the AIDev study (chore=0.84, docs=0.82, refactor=0.71,
fix=0.66, test=0.62, perf=0.55). Cross-repo weight transfer is a Growth feature.

### Technical Success

| Criterion | Target | Test method |
|---|---|---|
| Autonomous completion | ≥95% of invocations, no mid-flight input | 100-invocation automated suite; user-abort counts as neutral, not failure |
| Routing decision latency | <5ms Thompson Sampling selection | Benchmark: 10k bandit state, SQLite index on (task_type, provider) |
| Memory query latency | <200ms with 10k entries in scope | Benchmark: full recall() on 10k-row SQLite |
| Storage footprint | <50MB at 10k entries | Outcome records only — no full request/response payloads stored |
| Error surfacing | 100% of failures surfaced (logged + returned to user) | Error injection across all provider failure modes |
| Single-instance integrity | PID lock prevents concurrent sessions; stale PIDs auto-healed | Concurrent process test + kill-and-restart sequence |
| Provider auth validation | Missing env var detected at startup before any delegation | Test: invoke with each provider's env var unset |
| Deferred Q-update correctness | Tier 3 git signal applied to correct delegation record | Integration test: plant a known revert in git history, verify Q-value decremented for that provider + task type |

### Fallback Chain Semantics — RL Signal Specification

This is a correctness requirement, not an implementation detail:

- **Originally selected provider fails:** `outcome=failure` + `failure_class`
  recorded for that provider + task type. Thompson Sampling `beta` incremented
  for that arm only. Provider penalized for this task type.

- **Fallback provider succeeds:** Logged as a separate event tagged
  `fallback_reason: "primary_failed"`. Thompson Sampling `alpha` for the fallback
  provider is **not** updated in real-time. Fallback success records are analyzed
  post-hoc (via `reflect()`) to determine whether they track with the fallback
  provider's direct-delegation performance. Only after that correlation is
  established does fallback success feed into the bandit.

- **Rationale:** Penalizing the original provider but not immediately rewarding
  the fallback keeps the signal clean. A fallback succeeds partly because it was
  available, not necessarily because it is better at this task type. Conflating
  availability with capability biases the bandit toward whichever provider has the
  best uptime, not the best outputs.

- **Both writes (primary failure + fallback log) are atomic** — written in a
  single SQLite transaction. If the process is killed mid-write, no partial record
  is committed.

### Task-Type Inference — Confidence Gating

Task type is auto-inferred from the prompt at delegation time using the 13-type
hardcoded taxonomy (feat / fix / refactor / test / docs / style / perf / build /
ci / chore / revert / migration / review).

- Each inference includes a `confidence_score` [0–1].
- Inferences below a minimum confidence threshold (default: 0.6) are stored in
  the delegation record but **excluded from bandit training**. The delegation
  still proceeds; the outcome simply does not update any arm's Q-value.
- Low-confidence outcomes accumulate in the store for future post-hoc analysis
  (e.g., to train a better classifier or to prompt Somyung for manual
  reclassification).

### Measurable Outcomes — Ship/No-Ship Gates

*ACs are grouped by capability cluster — not by priority. Every AC is a release blocker. Sprint-priority is captured in §Project Scoping & Phased Development.*

Eleven falsifiable acceptance criteria (AC-1 through AC-10, plus AC-CRITIC-1). Any single failure is a release blocker:

**AC-1 — Safety (hard gate):**
Zero secret values appear in any provider API payload across 100 test invocations
against all four providers. A secret is: (a) any value matching a known credential
pattern (AWS keys, GitHub tokens, OpenAI keys, Anthropic keys), (b) any value
present in `.env` files in the test repo, (c) any env var value whose name
contains KEY, TOKEN, SECRET, or PASSWORD. Audit: outbound HTTP request logging +
automated regex scan against all three categories. Test setup: repo with
deliberately planted secrets in `.env` and env vars; confirm none appear in any
provider request payload. One match = P0 blocker.

**AC-2 — Routing improves (learning gate):**
Composite reward score (T1 × 0.3 + T2 × 0.3 + T3 × 0.4) for delegations in
invocations 200–250 is ≥15% higher (absolute) than invocations 1–50, within the
same controlled repo. P-value ≤0.05. Tier 3 signals resolved from git history at
the 14-day mark. Mid-point diagnostic at invocation 100: if routing entropy is
unchanged and composite reward shows no trend, halt and diagnose the bandit before
continuing to 250.

**AC-3 — Autonomous operation (UX gate):**
≤5 of 100 `/metis:do` invocations require mid-flight user input in a standard
Claude Code session (first-time provider auth setup excluded). Auth failure and
provider error count against this criterion. Duration does not — a long-running
delegation that completes silently passes.

**AC-4 — Visible Learning (legibility gate):**
A developer who has completed 20 invocations can explain, without reading
documentation, why Metis made its last routing decision. Measured by: a visible
routing-rationale surface in CLI output (provider name + confidence tier +
last-decision signal), exposed inline per invocation (FR18) and post-hoc via
`/metis:why` (FR28). Full definition in Validation Approach §; FR mapping in the
FR → AC Coverage Matrix.

**AC-5 — Memory legibility (differentiation gate):**
By invocation N (target N=20, validated in dogfooding), the user can observe a
routing shift attributable to accumulated memory — operationalized as: at least
one routing decision where the same `(task_type, repo)` pair selects a different
provider than it did at invocation 1, AND `/metis:why` or the plan card surfaces
the memory-derived signal (world fact, entity summary reference, or evolving
belief citation) that contributed to the shift. Without this AC firing, the
compounding-memory thesis is shipped but not legible — a competitor with a
simpler router wins on perceived simplicity.

**AC-6 — Failure-class taxonomy coverage (validation gate):**
Before marketplace launch, the 14-value `failure_class` enum must survive contact
with 20 real failure cases captured during dogfooding. Acceptance: each of the 20
cases maps cleanly to exactly one of the 14 values (no `unknown`-bucket overflow,
no taxonomy collisions where one case fits two values) AND maps cleanly to exactly
one `signal_class` (`fault` / `preference` / `correction` / `aborted` / `ambiguity`). Failures:
revise the enum or the signal_class join table and re-run. Prevents the taxonomy
from being theoretical coverage that breaks against real-world failure modes.

**AC-7 — Per-repo memory citation (thesis-defensibility gate):**
`/metis:why` MUST cite at least one historical outcome from the current repo's
memory when that outcome influenced the routing decision. Specifically: when the
routing decision was shaped by `agent_experiences`, `world_facts`,
`entity_summaries`, or `evolving_beliefs` from the current repo, `/metis:why`
output MUST include a citation block naming the source network and the specific
record(s) that contributed. Acceptance: in a controlled dogfood scenario with
≥10 prior delegations on a single repo, ≥80% of `/metis:why` invocations on
routing decisions whose memory-derived component was non-zero must surface at
least one repo-specific citation. Without this AC firing, the thesis claim
*"Metis's routing intelligence is trained on YOUR codebase's specific failure
patterns"* is unprovable — the user has no way to observe repo-specificity in
the routing rationale, and the differentiation collapses to "AI router with
unspecified internal state."

**AC-8 — Reviewer ≠ Implementer (delegation-thesis gate):**
For any delegation whose inferred `task_type ∈ {review, audit, critique}`, the
selected provider MUST differ from the provider that most recently authored
implementation code in the touched files (within the last 7 days of git
history). Acceptance: in a controlled test repo where Claude is recorded as
the implementer of `src/auth/middleware.ts`, a subsequent
`/metis:do "review the auth middleware for correctness"` routes to a non-Claude
provider in ≥95% of trials across 20 controlled invocations. If the recent
implementer is unknown or git history is empty, the rule does not apply and
the default routing proceeds. Without this AC firing, the thesis claim
*"fresh perspective from a different model"* is aspirational — routing might
happen to pick a different model for unrelated reasons, but the differentiation
is not enforced.

**AC-9 — First-Run Without Configuration (adoption-thesis gate):**
A user who installs Metis from the Claude Code marketplace and runs
`/metis:do <any reasonable task>` MUST receive a successful delegation within
60 seconds, with zero configuration files authored. Acceptance: an automated
end-to-end test installs Metis on a clean filesystem (no `.metis/config.jsonc`,
no `~/.metis/config.jsonc`), provisions one provider's credential via env var,
and invokes `/metis:do "summarize the README"` — the test passes if the
delegation completes successfully and no JSONC file is required to be authored
by the user during the flow. Without this AC firing, the thesis claim
*"no configuration required to start"* is a prose claim without enforcement,
and onboarding ergonomics drift unnoticed.

**AC-10 — signal_class routing behavior (training-poisoning prevention gate):**
Routing behavior under each `signal_class` value MUST be correct, not just the
enum mapping (AC-6 validates the enum; AC-10 validates the behavior). Acceptance:
in a controlled test harness with seeded delegation records, (a) records with
`signal_class: preference` (e.g., `plan_rejected`) MUST NOT decrement the Q-value
of the arm that produced the rejected output — verified by comparing pre/post
Q-state in ≥20 trials with zero unintended decrements; (b) records with
`signal_class: fault` MUST decrement the Q-value per §TS-1.4 in ≥95% of
applicable trials; (c) `preference`-class records MUST route to the replan
policy (not the fallback chain) in 100% of trials. Without this AC firing,
the signal_class taxonomy is decorative — the bandit's training data quietly
mixes preference and fault signals and credit assignment breaks invisibly.

**AC-CRITIC-1 — Critic adversarial credential review (Layer 2 safety gate):**
The Critic sub-agent (FR-CRITIC-1, §TS-SECURITY-1) MUST catch credential/secret
exposure in plans **scoped to credential exposure only** — NOT general plan
quality, NOT "destructive command" judgment, NOT stale-entity detection (the
Stale Entity Validator owns that, deterministically). Acceptance: against a
version-controlled corpus of 50 synthetic plans — 25 UNSAFE (each with exactly
one injected credential violation drawn from a fixed taxonomy: plaintext secret
in a step, credential to a non-secret sink, exfiltration path, unsafe op without
scoped credential boundary, credential reuse across provider boundary) and 25
SAFE (structurally similar, credential handled correctly, including near-miss
decoys that name a secret without exposing its value) — the Critic catches
≥23/25 UNSAFE (≥90% recall) at FP ≤2/25 SAFE (≤10% false-positive). Ground truth
is deterministic: each plan is template-generated from a known-defect or
known-clean spec, the label IS the generator input (committed alongside the
plan). Because the Critic is a non-deterministic LLM, the bar MUST hold on
**every** CI run, not on average. v1 corpus is fixed at 25/25; scaling to 50/50
for tighter false-positive resolution is a v1.1 tightening on the same harness.
The harness is a net-new classifier-evaluation harness (labeled-corpus loader,
confusion-matrix scorer) built as an architectural sibling of AC-1's harness
(shared CI integration + fixture conventions), NOT a reuse of AC-1's
presence-assertion harness. Effort is sized when §TS-SECURITY-1 is authored.
Without this AC firing, NFR-S1's Layer 2 claim is a prose assertion with no
verified second-pass enforcement beyond the static pattern scan.

## Project Scoping & Phased Development

### MVP Strategy & Philosophy

**MVP framing: Problem-solving MVP.** Validate that plan-confirmation + Thompson Sampling bandit routing + four-network compounding memory together solve self-review blindness (via delegation) and session amnesia (via accumulated repo knowledge). The MVP is complete when a solo dev can use Metis on one repo for 30 days and the bandit + memory state demonstrably improves routing decisions a returning user can verify (operationalized via AC-5 Memory Legibility).

**Resource requirements:** Solo senior engineer over **~8 calendar weeks (9 with buffer)**. Sized at ~40 engineer-days total: plan-confirmation feature (~17.5d), four-network memory architecture (~16d), integration/polish (~4d), memory↔plan wiring (~2-3d). A two-engineer parallel slice could compress to ~5 weeks if slices are clean.

**Mid-sprint signal-volume sanity check (week 4 of 8):** The fragile assumption underlying v1 is that four-network memory + Thompson Sampling bandit routing produces *interpretable* learning signal within 8 weeks of solo dogfooding volume. If signal is too sparse, the RL loop becomes theater. **Week-4 gate:** evaluate dogfood telemetry — accept-rate distribution, plan-confirmation signal class distribution, T1/T2/T3 resolution counts, per-arm observation depth. If signal volume is below the threshold to discriminate between arms within the 8-week window, halt and pivot — either (a) compress the bandit arm space (fewer task types), (b) extend the dogfooding window, or (c) accept a heuristic-routing fallback for v1 with RL deferred to v1.1. **This is not a soft milestone — without it, the AC-2 learning gate becomes unfalsifiable.**

**Phasing labels:** v1 (MVP) / v1.1 (next iteration informed by dogfood data) / v2 (long-term).

---

### v1 / MVP — Complete Capability Set

#### Core User Journeys Supported

All six journeys (see User Journeys section): Happy Path Day 30, Cold Start Day 1, Provider Failure + Fallback, RL Loop Closes Day 14, Routing Delta Across Invocations Day 8, Full Chain Exhaustion.

#### Must-Have Capabilities

**Commands (5 + Ctrl+C):** *(canonical definitions in Developer Tool Requirements §Command Surface)*

| Command | Purpose |
|---|---|
| `/metis:do <task>` | Autonomous end-to-end delegation; foreground; result inline |
| `/metis:why` | Post-hoc routing explanation (AC-4 surface) |
| `/metis:status` | Cold-return readout: current mode + last 5 decisions + accept-rate + memory-legibility one-line surface (AC-5) |
| `/metis:help` | Inline help (≤20 lines); first-time `[?]` educational |
| `/metis:forget` | Single destructive concept; prompts `all` (wipe repo learning) / `old` (trim entries older than N days); `[!]` confirm + preview. Replaces the former `reset`+`prune` pair |
| **Ctrl+C** | Graceful in-process abort of a running `/metis:do` + deterministic startup reconciliation of orphaned in-flight records. Not a slash command — abort is needed exactly when the input line is unavailable |

**Plan-Confirmation Feature:**
- Provider-adapter contract (`generate_plan` + `execute(approved_plan)`)
- Plan annotation via heuristic scan, **pure-heuristic in v1** (memory-aware annotation is v1.1)
- **Stale entity validation at plan-time** (non-negotiable — prevents the "plan references refactored-away entity" embarrassment scenario)
- Plan card UX with single-key affordances `[a]/[r]/[e]/[d]/[?]`, `Enter` no-op, 250ms visible lockout
- Receipt-line footer `· plan ✓` + always-on off-ramp discoverability hint
- Reject path: cap 2 reroutes → Full Chain Exhaustion fall-through
- Conservative reward signal: accept=0, reject=`plan_rejected` failure class, 30/30/40 T1/T2/T3 preserved
- On-ramp banner (asymmetric stakes safety feature): 3 reversions OR 2 rollbacks in last 10
- Default mode: `risky-only`

**Four-Network Compounding Memory (Hindsight architecture, all four networks):**

| Network | v1 implementation | v1 acceptance criterion |
|---|---|---|
| Agent experiences | SQLite outcome records, T1/T2/T3 reward fields, ctx_hash | `reflect()` on identical repo state produces byte-identical outcome rows |
| World facts | SQLite table `(repo, fact_key, value, ts)`; deterministic extraction (deps, languages, package.json contents, framework markers) | `reflect()` on identical repo state produces byte-identical `world_facts` rows (diff SQLite dump = empty) |
| Entity summaries | SQLite table `(repo, entity_path, summary, last_seen)`; lazy extraction on delegation touch (first N lines + exported symbols) | Row written iff entity touched in delegation AND (no row exists OR mtime newer than `row.extracted_at`) |
| Evolving beliefs | SQLite table `(repo, belief, observation_count, strength, last_updated)`; updated incrementally from agent experiences with belief-strength scoring + invalidation (§TS-1.13) | Every `agent_experiences` insert with confidence > X triggers belief update within N ms — X and N defined in §TS-1.13 |

Context injection blends all four sources via token-budget allocator with named priority order. **§TS-1.13 (belief-strength scoring + invalidation contract) is SPRINT-BLOCKING** — must specify formula, update rule, invalidation triggers, eviction threshold before Sprint 2 kickoff or `evolving_beliefs` work stalls.

**Routing & RL:**
- Thompson Sampling bandit per `(task_type, provider)` with `Q_INIT_PRIORS`
- 13 hardcoded task types, confidence-gated (below 0.6 → stored, excluded from training)
- T1 (completion, 30%) + T2 (PR inclusion, 30%) + T3 (reversion, 40%) reward signals
- Hardcoded fallback chain (Claude → Codex → Copilot CLI → Ollama) built at startup. **The order is hardcoded for v1 with explicit rationale**: Claude leads as the assumed-strongest planner for the 13 task types at time of writing; Codex follows as the next most capable; Copilot CLI provides a third independent provider; Ollama serves as terminal local-only fallback for offline/private use. The order is intentionally non-configurable in v1 — once user-configurable order ships (v1.1), users can override based on their own dogfood data. The bandit's per-arm Q-values progressively *override* the static order as observations accumulate; the chain matters most at cold-start before the bandit has signal.
- `reflect()` startup function: cursor advancement, T3 detection, memory population (across all four networks)

**Distribution & Runtime:**
- Claude Code marketplace (canonical) + clone+`install.sh` (dev/fallback)
- Shared `scripts/init.sh` post-install hook (SQLite DDL, `~/.metis/` setup, prior seeding)
- Plugin layout conforms to marketplace manifest (§TS-1.9)
- Node.js ≥18, ES2022/CommonJS, single-instance PID lock (per-install, not per-workspace; workspace-scoped lock files are v1.1)
- Schema-versioned SQLite with atomic migrations

**Storage & Telemetry:**
- SQLite `metis.db` (state) + JSONC config files (intent) — separated by concern
- NDJSON debug log at `~/.metis/debug/YYYY-MM-DD.jsonl`, 30-day/10MB retention
- `invocations` telemetry table — unblocks v1.1 threshold-tuning work

**Settings:**
- JSONC format, `.metis/config.jsonc` (repo) + `~/.metis/config.jsonc` (global)
- CLI flag > repo > global > defaults; top-level key replace
- Zod source-of-truth, `zod-to-json-schema` for `$schema` autocomplete
- Graduated validation (file missing → defaults; syntax → fail closed; unknown key → warn; bad value → default + warn)

**Security & Trust Boundaries:**
- Three trust boundaries (Execution / Credential / Runtime Contracts)
- Two-layer credential blocklist (task description + injected context); unified pattern registry shared with plan annotation
- 14-value `failure_class` enum (incl. `plan_rejected`, `plan_modified`, `aborted`), validated per AC-6 against 20 real dogfood failure cases
- Four protected surfaces for credentials (SQLite / subagent prompts / log output / NDJSON)

---

### v1.1 — Next Iteration (informed by v1 dogfood data)

| Item | Why v1.1 (not v1) |
|---|---|
| `/metis:why --bad` manual T3 correction | v1 T3 attribution is conservative (attributes nothing rather than wrong) on rewritten history. Manual correction requires reward-pipeline consistency work — late T3 injection means reward retraction/deferred-finalization, AC-2 eligibility re-check, and an observed-vs-human-asserted signal_class distinction. Surfaced as a `--bad` offer in the `/metis:why` output where the user is already looking at the decision they want to contest. |
| Cross-session `/metis:abort` escape hatch | v1 ships in-process Ctrl+C abort + startup reconciliation (§TS-1.16). A narrow second-terminal kill ("stop the run I left going elsewhere") is a v1.1 nicety once the in-process contract is proven. |
| Off-ramp suggestion prompt at threshold (20 clean accepts) | Threshold is a guess without telemetry; v1 ships always-on footer hint instead |
| Memory-aware plan annotation | Decoupled from v1 plan-confirmation critical path; revisit once memory data accumulates |
| Full `/metis:status` tinkerer dashboard (bandit Q-values, posteriors, decision history) | Worker minimum ships in v1; tinkerer surface added if dogfood demand emerges |
| fastembed BGEBaseEN semantic embedding | Upgrades world facts + entity summaries from substring match to semantic search |
| Cross-repo Q-value transfer | Real innovation claim; worth elevating if monorepo / multi-repo workflows benefit |
| Task-type classifier (trained on accumulated low-confidence outcomes) | Unblocks the below-0.6-confidence records currently excluded from bandit training |
| Workspace-scoped lock files + workspace-scoped memory partitioning | Multi-project isolation, defer until dogfooding hits the case |
| Fallback success fed to bandit (post-hoc correlation) | Operational signal refinement |
| Conditional T0 reward (plan-accept × downstream T2 success) | Revisit if telemetry shows accept-correlated outcome differences across arms |

---

### v2 — Vision / Long-Term

| Item | Notes |
|---|---|
| usearch ANN index (above 5k entries per scope) | Scale-only optimization; solo dev MVP won't hit |
| Mem0 optional storage backend | Backend pluggability; defer until real use case emerges |
| Multi-user / team-shared memory with repo-scoped isolation | Cross-team collaboration; out-of-scope for v1 |
| Community-contributed routing priors (opt-in anonymized Q_INIT) | Network-effect feature; depends on adoption |
| Provider performance leaderboard surfaced on `/metis:status` | Couples to full tinkerer dashboard |
| Automatic CLAUDE.md seeding on first run | Onboarding nicety, not critical path |
| Additional Anthropic-shipped Claude Code surfaces | Replaces the "runs inside Codex" claim — keeps multi-surface ambition aligned with locked non-goals |

---

### Risk Mitigation Strategy

**Technical Risks:**

| Risk | Mitigation |
|---|---|
| Thompson Sampling cold-start window for solo dev (Primary Technical Bet, §Innovation) | Sprint 2 prototype validation prerequisite; heuristic fallback if convergence >6 months |
| Four-network memory: token-budget overflow during context injection | Token-budget allocator with named priority order across the four networks (priority: agent experiences → entity summaries → world facts → evolving beliefs, configurable). Trimmed when budget exceeded; allocator contract in §TS-1.14 (new) |
| §TS-1.13 (belief-strength scoring) is sprint-blocking | Resolve in Sprint 1 alongside §TS-1.10 (Plan schema), §TS-1.11 (annotation pattern registry), §TS-1.15 (memory write-path), and §TS-1.16 (cancellation); without §TS-1.13 spec, `evolving_beliefs` slips in week 5 |
| Four-network memory: deterministic extractors miss important signals | Extractors are bounded heuristics, not pretending to be intelligent. v1.1 fastembed upgrade handles fuzzy retrieval. Document the gap honestly. |
| `evolving_beliefs` invalidation strategy unproven | §TS-1.13 specifies the contract; failure mode is stale beliefs degrading routing, not breaking it — graceful degradation |
| Plan-confirmation provider-adapter contract (§TS-1.10) blocks Sprint 2 | Sprint-blocking flag set; design must close before plan-confirmation implementation starts |
| Stale entity references in plan cards | Plan-time validator non-negotiable in v1 (mtime + symbol grep at plan generation and on each render) |
| Marketplace manifest unknowns (§TS-1.9) | Dev path via clone+install.sh decouples marketplace dependency from v1 dogfooding |

**Market Risks:**

| Risk | Mitigation |
|---|---|
| Demand-side gap (no primary research on whether developers experience multi-model routing as a pain point) | Validated through early-access dogfooding cohort before public launch |
| Anthropic ships native multi-model routing inside Claude Code | T3 structural moat — git-derived outcome signal remains valuable independent of LLM provider stack; reposition as "memory layer on top of native routing" if needed |
| Competitor ships simpler AI router minus memory; wins on perceived simplicity | AC-5 (Memory Legibility) — user-observable routing shift attributable to memory by session N=20. Memory must be legible, not just functional. |
| User perceives plan-confirmation as friction rather than learning | AC-4 (Visible Learning) makes RL legible; always-on footer hint surfaces the off-ramp from invocation 1; on-ramp banner provides safety net |
| Compounding memory thesis fails to compound in practice | Cold-return scene served by `/metis:status` minimal + memory-legibility line; `/metis:why` shares plan-card vocabulary; explicit narrative thread in README |

**Resource Risks:**

| Risk | Mitigation |
|---|---|
| 8-week estimate slips | Build order locked: SQLite schemas → agent_experiences → provider-adapter contract → world_facts/entity_summaries → memory write-path (§TS-1.15) → cancellation contract (§TS-1.16, depends on TS-1.15) → plan-confirmation UX → evolving_beliefs + blended allocator → integration/polish. evolving_beliefs is the most-deferrable item if mid-sprint cuts needed. |
| Sprint 2 blocked by open §TS-1 items | Six sprint-blocking specs resolve in Sprint 1: TS-1.3 (Codex integration), TS-1.4 (failure_class/signal_class join), TS-1.10 (Plan schema), TS-1.11 (annotation pattern registry), TS-1.13 (belief-strength scoring), TS-1.15 (memory write-path), TS-1.16 (cancellation contract). **Dependency order:** TS-1.15 (memory write-path) MUST be specified before TS-1.16 (cancellation) — TS-1.16's transactional-rollback boundary is undefined until the memory write it rolls back is specified. |
| Scope creep during v1 dogfooding ("Explicitly Out of Scope" items reopened) | v1.1/v2 backlog has explicit rationale per item; reopening requires PRD amendment, not casual decision |

---

## User Journeys

### Journey 1: Happy Path (Day 30)

**Opening Scene:** Tuesday afternoon. Somyung just refactored Go connection pool logic. He doesn't want Claude reviewing what Claude wrote.

He types: `/metis:do review this PR for performance regressions`

**Rising Action:** Metis surfaces routing rationale immediately: *"Routing to Codex — 3 prior Go performance reviews succeeded vs. 1 for Claude in this repo. Note: routing is task-type-level, not module-level — override if this module differs significantly from prior reviewed code."* A prior delegation note is injected as context: *"Last time we reviewed this module, the bottleneck was the connection pool."* Delegation runs. Somyung switches to Slack.

Eight minutes later, the result is inline.

**Climax:** The review catches a pool leak pattern Claude had introduced and didn't flag in its own output. Fresh perspective, delivered.

**Resolution:** Somyung commits the fix. Metis records T1 complete. T2/T3 deferred — to be resolved against git history at next startup.

**Capabilities revealed:** Outcome injection as context, per-invocation routing rationale with specificity limit, autonomous completion, T2/T3 deferred reward setup.

---

### Journey 2: Cold Start (Day 1)

**Opening Scene:** First invocation. No prior outcomes. Metis has never seen this repo.

**Rising Action:** At startup, Metis validates env var presence for all configured fallback chain providers and pings Ollama health endpoint (2s timeout). All checks pass. Somyung types: `/metis:do write unit tests for this auth module`.

Metis routes to Claude and displays: *"Routing to Claude — no repo-specific history yet. Using task-type baseline: test tasks complete successfully at 62% across repos. Confidence builds after 20 observations per provider (per-invocation caveats) and 50 (cumulative view)."*

The delegation runs. Test scaffolding comes back — acceptable.

**Resolution:** First delegation logged. T2/T3 pending. Somyung sees the baseline number, understands where it comes from, and knows what will change it. No false confidence. No vague growth language.

**Capabilities revealed:** Q_INIT_PRIORS cold-start, calibrated uncertainty messaging (baseline %, observation count targets), startup auth validation for full fallback chain (presence + format check; Ollama health ping), first-run experience.

**Known limitation surfaced:** Startup validates env var presence and format only — not key validity. An expired key is caught at first delegation with a clear error and remediation step. This failure mode is counted against AC-3.

---

### Journey 3: Provider Failure + Fallback

**Opening Scene:** Somyung invokes `/metis:do migrate this schema to the new format`. Codex is selected (3 prior migration successes). Codex returns a timeout after 300s (the per-provider delegation timeout).

**Rising Action:** Metis logs `outcome=timeout, failure_class=provider_timeout, fallback_depth=0` for Codex on the `migration` task type. Thompson Sampling beta incremented for that arm. Fallback chain activates — next in config is Claude, `fallback_depth=1`.

**Climax:** Claude completes the migration. Metis surfaces: *"Codex timed out (300s). Fell back to Claude (claude-sonnet-4-6). Codex penalized for migration tasks in this repo. Fallback success logged separately — not yet fed to routing model."*

**Resolution:** Primary failure + fallback log written in a single `BEGIN/COMMIT` SQLite transaction — both records or neither. T1 deferred until chain resolution: written as `COMPLETED` on Claude's success in the same transaction. Somyung proceeds with Claude's output.

**Capabilities revealed:** Per-provider delegation timeout (300s default, configurable), fallback chain execution, RL signal separation (penalize A only, log B with `fallback_depth`), atomic single-transaction dual-write, T1 write deferred until chain resolution, 100% error surfacing.

---

### Journey 4: The RL Loop Closes (Day 14)

**Opening Scene:** Two weeks ago, Metis routed a `fix` task to Codex. The output looked right. Somyung merged it. Three days later, he found a subtle regression. He ran `git revert`. His commit message: `"oops, undo last"` — non-standard.

He didn't tell Metis anything.

**Rising Action:** Today, Somyung opens a new Claude Code session. Before any delegation, Metis runs `reflect()` quietly at startup — advancing its cursor (`last_scanned_commit_sha` in `metis_meta`) through commits since the last check. It finds a commit that produces an inverse patch on the same files touched by the Codex delegation. Commit message doesn't matter — diff-based detection matches on content, not convention.

T3 signal resolved: `outcome=reverted`.

**Climax:** Metis updates the delegation record atomically: T3 reward = 0.0. Composite reward recalculates: `(1.0 × 0.3) + (1.0 × 0.3) + (0.0 × 0.4) = 0.60`. Codex Q-value for `fix` tasks decremented. Thompson Sampling beta incremented for that arm.

No notification. No prompt. Somyung sees nothing.

**Resolution:** Next `fix` delegation draws from a Q-value that includes the reversion signal. The loop is closed — without Somyung lifting a finger.

**Ambiguous history:** When git history is rewritten (squash merges, rebase workflows) such that reversion attribution cannot be made with confidence, v1 T3 attribution is **conservative — it attributes nothing rather than attributing wrong**. A wrong T3 penalty poisons the bandit worse than a missing one. Manual T3 correction (`/metis:why --bad`) for these ambiguous cases is a v1.1 surface (see v1.1 backlog), pending the reward-pipeline consistency work it requires (late T3 injection means reward retraction/deferred-finalization + AC-2 eligibility re-check + observed-vs-human-asserted signal_class distinction).

**Capabilities revealed:** `reflect()` with startup cursor advancement, diff-based reversion detection (not commit-message-dependent), atomic Q-value update to correct delegation record, T3 reward computation, no user action required for RL feedback, conservative attribution on rewritten history (attribute-nothing-rather-than-wrong).

**Known limitation:** T3 attribution in ambiguous cases (multiple delegations touching the same file) goes to the most recent delegation within the 14-day window. Squash and rebase workflows reduce T3 signal reliability — documented in README, not treated as a bug.

---

### Journey 5: Routing Delta Across Invocations (Day 8)

**Opening Scene:** Day 3, invocation 7. Somyung runs `/metis:do fix the race condition in the worker pool`. Metis routes to Claude. Rationale: *"Routing to Claude — fix tasks at 66% baseline. 2 prior fix invocations in this repo, split evenly. Low sample size (2 obs) — routing may shift significantly with next outcomes."*

**Rising Action:** Five days later, invocation 17. Same task type: `/metis:do fix the retry logic on the API client`. Metis routes to Codex. Rationale: *"Routing to Codex — 3 of 4 prior fix tasks in this repo succeeded with Codex vs. 2 of 6 with Claude. Low sample size (4 obs for Codex) — routing may shift with next outcomes."*

Somyung notices the routing changed.

**Climax:** He doesn't override. He doesn't check status. He just watches. The Codex result is better — catches an off-by-one the Claude fix had missed. He commits it.

He says nothing. But a unit of silent trust just transferred.

**Resolution:** No message. No "routing improved because of X." The rationale was visible, the result validated it, and Somyung's behavior — no override, no follow-up — is the metric. Trust as observable behavior.

**Capabilities revealed:** Per-invocation routing rationale with accumulated evidence (not just priors), sample-size warning below 20 observations per arm, routing decision that visibly changes as history accumulates, observable delta between invocations as the primary learning signal.

**Note on exploration:** If any provider in the fallback chain has fewer than 5 total invocations, the routing logic force-samples it at a proportional rate and logs the selection as `forced_exploration`. Prevents prior-lock exploitation where an early-winning provider starves the bandit of comparative data.

---

### Journey 6: Full Chain Exhaustion

**Opening Scene:** Somyung runs `/metis:do refactor this module for testability`. At startup, Metis validated all providers — Ollama health ping passed, all API keys present and format-valid. But now, at delegation time, the runtime environment has changed: Ollama's local server went down after startup. Codex returns a rate limit error. Claude's API returns 503.

These are runtime failures — not startup misses.

**Rising Action:** Every provider in the chain has failed. Metis does not silently drop the task. It does not partially write a record. No T1 is logged.

**Climax:** Metis surfaces:

```
Delegation failed — all providers exhausted.

  ollama (fallback_depth=0)  → unreachable (connection refused)
  codex  (fallback_depth=1)  → rate_limited
  claude (fallback_depth=2)  → api_unavailable (503)

No output produced. No routing record updated.
Suggested: check Ollama server status, verify Codex rate limit window.
```

**Resolution:** Nothing is written to the database — no partial outcome, no corrupted arm state. PID lock is released in the process exit handler. Somyung knows exactly what happened and why. He fixes the Ollama server, re-invokes. The delegation runs clean.

**Capabilities revealed:** Full fallback chain exhaustion with per-provider failure class and `fallback_depth`, no partial RL writes on total failure, 100% error surfacing rate, PID lock released on exit, startup validates full chain (runtime failures are separate from startup validation scope).

---

### Journey Requirements Summary

| Journey | Core Claim Proven | Key Capabilities |
|---|---|---|
| Happy path (Day 30) | Autonomous delegation works; routing rationale visible | Outcome injection, rationale with specificity limit, T2/T3 deferred setup |
| Cold start (Day 1) | System knows what it doesn't know | Q_INIT_PRIORS, calibrated uncertainty, full-chain startup auth |
| Provider failure + fallback | No babysitting; RL signal stays clean | Per-provider timeout, atomic single-transaction dual-write, signal separation |
| T3 closes automatically | RL loop closes without user action; moat is real | `reflect()` cursor + diff-based detection, atomic Q-update, escape hatch |
| Routing delta (Day 8) | System actually learns; routing changes as evidence builds | Per-invocation rationale with sample-size caveat, observable delta, exploration floor |
| Full chain exhaustion | No silent failures, ever | All-providers-fail handling, no partial writes, 100% surfacing, PID cleanup |

### Open Spec Items Surfaced by Journeys

The following items require resolution before implementation stories are written:

| Item | Required Decision |
|---|---|
| T2 ingestion mechanism | How does Metis detect PR inclusion? Git hook, manual command, or polling? |
| T2 null-handling | T2 resolves as `null` after 7-day TTL; composite reward renormalizes: `T1×0.43 + T3×0.57` |
| `RoutingExplanation` type | Lock display contract: what fields are shown (arm counts, win rate, sample size, specificity note) |
| `reflect()` attribution on file overlap | Most recent delegation within 14-day window gets T3; squash/rebase = best-effort documented |
| Per-provider delegation timeout | Default 300s, configurable per provider in config |
| Below-gate routing path | Global arm + display `"task type unclear — using overall baseline"` |
| Two-tier observation threshold | 20 obs → per-invocation caveat; 50 obs → cumulative "still learning" label |
| Minimum exploration floor | Force-sample providers with `<5` invocations; log as `forced_exploration` |
| Ollama startup validation | Health check ping to `localhost:11434`; 2s timeout; failure = provider unavailable for session |
| SQLite required indexes | `(repo_root, task_type, provider)`, `(repo_root, created_at)`, `(T3_status, created_at)` |
| `n_alpha`/`n_beta` in arm schema | Required for 50-obs threshold computation; not derivable from Q-value alone |
| AC-2 eligible invocation count | Gate uses above-gate (≥0.6 confidence) invocations only, not raw count |

---

## Domain Requirements

> *"Every constraint in this section exists to protect the developer's trust: when Metis routes silently, it should feel like expertise; when it stops, it should feel like care; when it's uncertain, it should say so."*

Metis operates across three distinct trust boundaries. Requirements are organized by boundary because the failure modes, ownership, and review cadence differ at each layer. Implementation details (schemas, enum values, exact contracts) live in the companion tech spec (see §TS-1 stub below).

```
┌─────────────────────────────────────────────────────────────┐
│                    USER ENVIRONMENT                         │
│   ┌──────────────┐         ┌──────────────────────────┐    │
│   │  Terminal /  │         │  Credential Store        │    │
│   │  Claude Code │         │  (env vars, OLLAMA_HOST) │    │
│   └──────┬───────┘         └────────────┬─────────────┘    │
│          │ stdin/stdout                 │ read-only at init │
└──────────┼──────────────────────────────┼───────────────────┘
           ▼                              ▼
┌──────────────────────────────────────────────────────────────┐
│              EXECUTION TRUST BOUNDARY                        │
│   ┌─────────────────────────────────────────────────────┐   │
│   │                  Metis Process                      │   │
│   │   Runtime Contracts · Node.js ≥18 · Fail-closed    │   │
│   │   ┌─────────────────────────────────────────────┐  │   │
│   │   │         CREDENTIAL TRUST BOUNDARY           │  │   │
│   │   │  Two-layer blocklist · AC-2 eligibility     │  │   │
│   │   └────────────────────┬────────────────────────┘  │   │
│   └────────────────────────┼────────────────────────────┘   │
└────────────────────────────┼────────────────────────────────┘
                             │ structured calls only
              ┌──────────────┼──────────────────────┐
              ▼              ▼              ▼        ▼
          [Claude]       [Codex]      [Copilot]  [Ollama]
         Agent tool       TBD          spawn    local HTTP
```

---

### Execution Trust Boundary

**Scope:** Everything that runs inside the Metis process, on the user's machine.

**Fail-closed** *(canonical definition)*: When capability state is unknown or detection fails, Metis assumes the capability is absent and disables the dependent feature. The system never silently degrades to a less-safe fallback. Applies at every capability gate: provider availability, plugin runtime, data directory access.

**Zero-config** *(canonical definition)*: A user who installs Metis and runs it without creating any configuration file gets a working product. Achieved through a hardcoded priority chain (Claude → Codex → Copilot CLI → Ollama) built at startup from providers with valid credentials. Metis reads `OLLAMA_HOST` for local model endpoint and `METIS_DATA_DIR` for data directory; documented defaults apply otherwise.

**Hybrid delegation model:** Metis delegates *reasoning* to providers, never *side effects*. The invocation path per provider is fixed at design time:

| Provider | Invocation path | Status |
|---|---|---|
| Claude models | Agent tool (subagent) | Confirmed |
| Codex | Agent tool OR `child_process.spawn` | **TBD — see below** |
| GitHub Copilot CLI | `child_process.spawn('gh copilot suggest')` | Confirmed |
| Ollama | `fetch(OLLAMA_HOST \|\| 'http://localhost:11434/...')` | Confirmed |

**Codex integration — two-path decision (open):**

| Criterion | Agent tool path | Spawn path |
|---|---|---|
| Sandboxing | Provider-enforced | OS process boundary |
| Credential exposure | Scoped to tool call | Inherits full env |
| Latency | Network round-trip | Local, sub-100ms |
| User permission prompt | None (implicit) | Required on first use |

*Decision owner: Architecture. Must resolve before Sprint 2 kick-off. Until resolved, Codex-dependent stories are blocked. Verification: Claude Code plugin SDK docs + Anthropic developer support if inconclusive.*

**Runtime floor:** Node.js ≥18.0.0 required. Hard floor, not a recommendation. Startup version guard exits before any other logic with a descriptive error if the floor is not met.

**No persistent background processes:** Metis runs only within a Claude Code session. `reflect()` runs at session startup via cursor advancement — not as a daemon. All deferred signals (T2, T3) are resolved at the next startup or on `/metis:status`.

**Command layer decoupling (NFR):** Provider logic and routing logic MUST be decoupled from the Claude Code command layer. The command layer is a thin adapter. This constraint exists to support future Anthropic-shipped Claude Code surfaces as a refactor (not a rewrite), and explicitly NOT to enable porting to other IDEs (see Executive Summary non-goals). Enforced at code review.

**Delegation model — hard constraint:** All cross-provider delegations MUST use the **teammate subagent model** (Claude Code `session.create` with scoped `model`, `system`, `tools`, and `mcp_servers` fields). The `child_process.fork` pattern is explicitly rejected for cross-provider delegation — it does not benefit from Claude Code's tool-use and permission model. Fork is reserved for same-model Claude sub-delegations only. This is a load-bearing architectural constraint confirmed by Claude Code SDK research.

**Bandit calibration constraints (routing layer):**

- **Per-codebase isolation:** Bandit arms are scoped by `(project_path, task_type, provider)` — not global. Arms reset (priors widened) on codebase switch (detected via `git rev-parse --show-toplevel` mismatch). A developer's codebase-A routing history does not contaminate codebase-B.
- **Minimum probe thresholds:** At least 8–12 observations per arm before convergence assertions are valid. For high-variance providers (Ollama, which exhibits ≥30% run-to-run variance on identical prompts), minimum probe count is 30 before arm confidence is considered reliable.
- **Ollama Q_INIT_PRIORS — narrowed scope:** Ollama priors start **LOW** for `code_review`, `multi_file_analysis`, and `architectural_decision` task types. These task types require context breadth that local models structurally cannot match. Ollama priors are appropriate for `incremental_edit`, `explain`, and `test_generation`. This is not an anti-Ollama stance — it prevents the bandit from exploring to a dead end and wasting early observations on structurally-unsuitable arms.
- **Ollama stddev tracking:** The Ollama arm carries a per-arm `output_stddev` running estimate. High output variance (>30% run-to-run on identical prompts) is surfaced as a routing signal — the Ollama arm is deprioritized not only by Q-value but also by reliability estimate when stddev exceeds threshold. Prevents noisy-neighbor variance from masking a consistently poor capability signal.

---

### Credential Trust Boundary

**Scope:** Rules governing how Metis reads secrets from the environment and what it may do with them.

**Threat model:** Metis defends against accidental exfiltration of developer credentials to external provider APIs via user-typed task descriptions or stale injected context — not against compromised provider endpoints or malicious repo files.

**Four protected surfaces:** API keys never appear in (a) any SQLite record, (b) any subagent prompt or context payload, (c) any log output, (d) any NDJSON debug log entry. The RAM claim is excluded — keys necessarily transit process memory during normal operation. The four surfaces are verifiable; RAM is not without a heap-dump harness.

**Two-layer static blocklist:** Patterns are versioned constants, updated at package publish via CI lint step against GitHub secret scanning patterns. Novel credential formats outside the pattern list are not caught — documented known gap.

- *Layer 1 (task description):* Scanned before delegation. On match → hard stop. User message: *"Metis stopped here. The request touches information that isn't routed — by design, not by mistake. Nothing was sent to any provider."*
- *Layer 2 (injected context):* Scanned before forwarding to any provider. On match → redact + structured NDJSON event. Layer 2 firing is an upstream failure indicator. Delegation result footnote: *"↳ Note: one or more fields were withheld before this was delegated. The response reflects what the provider received, not the full original context. See routing log for detail."*

**AC-2 eligibility** *(canonical definition)*: A delegation is AC-2 eligible if it completed and its failure class represents a provider capability signal — not a platform, config, or infrastructure failure. The full exclusion list is in §TS-1.4. The principle: only signals where the provider was reached and engaged with the task feed the routing intelligence.

**Empty provider chain:** If no providers have valid credentials at startup, Metis exits with setup instructions scoped to the detected environment (leads with the most likely available provider, not all four equally). This is a hard stop — delegation cannot proceed with zero providers.

**Startup validation scope:** Env var presence and format checked for all providers in the configured fallback chain. Ollama validated via health check ping (2s timeout). Validity (not just presence) is checked at delegation time — an expired key surfaces a clear error with remediation at first use.

**failure_class taxonomy:** Fourteen values governing Q-decrement behavior and AC-2 eligibility. Full table in §TS-1.4. Principle: platform and configuration failures do not decrement provider Q-values; provider capability failures do. **`plan_rejected`**, **`plan_modified`**, and **`aborted`** are three of the fourteen, all generated during plan-confirmation or mid-delegation but with distinct signal semantics (see signal_class below).

**signal_class (sibling field — NEW, captures semantic kind):** Every delegation record carries a `signal_class` alongside its `failure_class`. The two fields decompose what the record means for learning:

| `signal_class` | Meaning | Examples | Q-update behavior |
|---|---|---|---|
| `fault` | The world didn't cooperate (environmental/tool/provider failure) | `provider_timeout`, `provider_rate_limited`, `validation_failure`, `agent_tool_interface_error` | Standard Q-decrement per §TS-1.4 |
| `preference` | The user vetoed at the gate (no model-quality signal) | `plan_rejected` | **NOT routed through the fallback chain Q-update.** Routes to replan policy. Weighted separately (or excluded entirely) from the bandit's win-rate signal. Does NOT decrement Q on the rejected arm; instead increments a per-arm `rejected_count` for diagnostic surfacing. |
| `correction` | The user accepted the plan after editing — the proposed plan was directionally right but needed correction | `plan_modified` | **Highest-information user action.** The diff between proposed plan and accepted-after-edit plan becomes training data (plan-quality signal, distinct from outcome). Does NOT decrement Q — partial credit. Increments per-arm `modified_count`. Diff captured for v1.1 plan-quality regression training. |
| `aborted` | User cancelled the delegation mid-flight (Ctrl+C), or an orphaned in-flight record was reconciled after a hard process death | `aborted` | **Recorded but statistically silent.** Row persisted (required for FR32d orphan reconciliation and `/metis:why`); excluded from Q-update entirely — no decrement, no reward, no reliability down-weight. "No reward/penalty" means zero learning contribution, not zero record. |
| `ambiguity` | Insufficient context to attribute (kept distinct so future signal types can be added without collision) | reserved | Stored, excluded from training |

The taxonomy is intentionally split because mixing preference signals into a fault-trained bandit poisons credit assignment: the agent learns to avoid plans the user *would have approved* because some adjacent plan got rejected for unrelated reasons (scope, timing, mood). AC-6 validates that all 14 `failure_class` values map cleanly to exactly one `signal_class`. §TS-1.4 carries the full join table. §TS-1.13 (belief-strength scoring) reads both fields.

**`t3_confidence` field (companion to every T3 reward event):** T3 attribution is probabilistic, not binary. Every T3 reward record carries a `t3_confidence` score (0.0–1.0, starts at 1.0, attenuated by any of 6 documented conditions: squash-merge blur, rename heuristic failure, autonomous-rebase contamination, async attribution window, Ollama noisy-neighbor variance, legacy contamination / >14d gap). Q-update weight for T3 = `t3_weight × t3_confidence`; signals below `t3_confidence < 0.4` are excluded from Q-update entirely. Full attenuation formula in §TS-REWARD-1. This field is sprint-blocking because without it the bandit treats a squash-merged reversion identically to a clean file-level reversion — the two carry fundamentally different attribution reliability.

**Plan annotation reuses the two-layer blocklist:** The heuristic scan that annotates plans for the plan-confirmation feature (see Developer Tool Requirements) MUST reuse the same versioned pattern set as the Layer 1/Layer 2 credential blocklist. Plan annotation does not introduce a parallel scanner; it adds plan-specific patterns (destructive shell commands, schema-altering SQL, package installs) to the same registry. Single source of truth for "what is risky?"

---

### Runtime Contracts

**Scope:** Environmental guarantees Metis requires from and makes to the host.

**Single-instance enforcement:** One Metis instance per machine at a time, enforced via PID lock at `~/.metis/metis.lock`. Stale locks from crashes are auto-healed at startup. Concurrent startup race handled via exclusive file create. Details in §TS-1.5.

**Atomic schema migration:** All pending migrations commit as a single transaction or not at all. Database backed up before any migration attempt; restored atomically on failure. `schema_version` updated only after full batch commits. Downgrade detected at startup → clear error with installed version, required version, and remediation command.

**Structured debug log:** `~/.metis/debug/YYYY-MM-DD.jsonl` — one file per calendar day. Records bandit state at each routing decision (Q-values, draw values, arms considered). Context payload stored as SHA-256 hash only, never content. 30-day/10MB retention. MVP solo-developer only — retention policy and access model revisited before any multi-user feature ships.

**Response validation:** Non-empty string + not matching the static refusal-pattern list. Length floor dropped (too brittle — flags valid short outputs, passes verbose refusals). Task-type-conditional format validation deferred to Growth.

**Visible routing signals (inline, terminal-width):**
- Per-invocation: `→ Routing to claude-sonnet · reason: recent code context, 3 prior matches`
- Calibrated: `✓ Routing calibrated · claude-sonnet now preferred for this project type`
- Still learning: `~ Routing: learning · defaulting to claude-sonnet until patterns emerge`

**Non-English limitation:** Task-type inference is optimized for English-language prompts. Below-gate routing (global arm, prior-weighted) applies proportionally more often for non-English task descriptions. This is a product scope decision, not a technical constraint. Flagged for Growth classifier improvement.

**Cross-platform path handling:** All data directory paths use `path.join(os.homedir(), '.metis')` — never string concatenation. `OLLAMA_HOST` env var honored for non-default Ollama endpoints. `METIS_DATA_DIR` env var override for CI environments and containers.

---

### Companion Tech Spec Stub — §TS-1

*Implementation details excluded from this PRD. Stories may not be written against these items until the corresponding tech spec section is authored and reviewed.*

| Section | Heading | Blocks which FRs | Sprint-blocking? |
|---|---|---|---|
| TS-1.1 | Provider detection protocol (structural + semantic) | FR3, FR35 | No |
| TS-1.2 | Two-layer blocklist implementation (field names, schemas, CI assertion) | FR33, FR34 | No |
| TS-1.3 | Codex integration — chosen path (Agent tool OR spawn lifecycle) | FR3, FR5 (Codex arm) | **Yes — Sprint 2** |
| TS-1.4 | `failure_class` full enum (14 values incl. `plan_rejected`, `plan_modified`, `aborted`) + `signal_class` join table (`fault` / `preference` / `correction` / `aborted` / `ambiguity`) + Q-decrement table + replan-policy contract for `preference` + diff-capture contract for `correction` + statistically-silent contract for `aborted` + AC-2 eligibility exclusion list | FR16, FR17, FR17a | **Yes — Sprint 2** (signal_class join is sprint-critical to prevent training poisoning) |
| TS-1.5 | PID lock contract (4-step, TOCTOU-safe, cross-platform PID check) | FR41 | No |
| TS-1.6 | Schema migration contract (backup path, integrity check, renameSync restore); migration scripts are **numbered SQL files only** (e.g., `001_init.sql`); v1 schema changes: ADD COLUMN only — no DROP, no RENAME — to preserve zero-downgrade rollback | FR40 | No |
| TS-1.7 | NDJSON debug log schema (field definitions, pattern_id, ctx_hash, retention) | FR42 | No |
| TS-1.8 | i18n deferral scope (what is not internationalized; contract for future work) | (cross-cutting) | No |
| TS-1.9 | Claude Code marketplace manifest schema and validation | FR37 | No (last-mile) |
| TS-1.10 | `Plan` object schema (fields, types, required/optional) + plan-flow state machine | FR7, FR7a, FR8, FR9, FR10, FR11 | **Yes — Sprint 2** |
| TS-1.11 | Plan annotation pattern registry (unified with credential blocklist; scope tag for "credential" / "plan" / "both"; CI lint contract) | FR8 | **Yes — Sprint 2** |
| TS-1.12 | Dismissal-history state model (where it lives, retention, reset semantics) | FR31, FR43 | No |
| TS-1.13 | Belief-strength scoring contract (formula, update rule, invalidation triggers, eviction threshold) for `evolving_beliefs` network | FR24 | **Yes — Sprint 2** |
| TS-1.14 | Context-injection token-budget allocator (priority order across the four memory networks, truncation policy, allocator schema) | FR25, FR25a | No (deferable to v1.1 if v1 ships simple concat) |
| TS-1.15 | Memory write-path triggers and idempotency contract — for each of the four networks: what events cause a write, write throttling, idempotency keys, mtime-based invalidation, failure isolation (one network's write failure cannot block another's) | FR21, FR22, FR22a, FR23, FR27 | **Yes — Sprint 2** (write surface specified separately from read; without this, "learns your repo as it works" is unimplementable) |
| TS-1.16 | `/metis:do` cancellation + startup-reconciliation contract — Ctrl+C graceful-abort sequence; cancellable provider-call interface for **both** `generate_plan` and `execute`; transactional/idempotent-replayable state-mutation boundary with a per-mutation-point finalize-vs-rollback disposition table; recorded-but-statistically-silent `aborted` terminal; **the unresponsiveness threshold that classifies an abort as `aborted` (responsive) vs `provider_timeout`/`fault` (hung) — exact duration + detection mechanism**; orphaned-in-flight-record lease (definition, heartbeat writer, expiry duration relative to the 300s delegation timeout) + deterministic reconciliation; **startup ordering: stale-lock heal (NFR-R1) → orphan reconciliation (FR32d) → `reflect()` T3/memory pass**; optional narrow cross-session `/metis:abort` escape hatch. Hard-depends on §TS-1.15 (cannot define the memory-write rollback boundary before the memory write-path is specified). | FR32b, FR32d, FR32e | **Yes — Sprint 2; sequenced after §TS-1.15** |
| TS-COMPACT-1 | PreCompact hook memory re-injection contract — hook registration in `plugin.json`, re-injection trigger (Claude Code fires `preCompact` event before context window compaction), token priority order across four networks during re-injection (same allocator as §TS-1.14), injection format, failure-silent behavior (compaction MUST NOT block on re-injection failure — re-injection is best-effort, not a hard dependency) | FR25, FR25a | **Yes — Sprint 2** (static CLAUDE.md injection does not survive reactive compaction; PreCompact hook is the only durable re-injection point confirmed by Claude Code plugin SDK) |
| TS-REFLECT-1 | `reflect()` at SessionStart — git cursor advance algorithm (SHA bookmark per repo stored in SQLite `reflect_cursor` table), T2 PR-inclusion detection pass (7-day TTL window via `gh pr list` or local `.git/FETCH_HEAD` heuristic), T3 reversion detection pass (commit window + file-path attribution + `t3_confidence` scoring per TS-REWARD-1), four-network population sequence, no persistent server requirement, startup ordering: stale-lock heal (NFR-R1) → orphan reconciliation (FR32d) → `reflect()` | FR26, FR27 | **Yes — Sprint 2** |
| TS-SECURITY-1 | Layer 2 PreToolUse Critic side-query contract (FR-CRITIC-1) — **scope: credential/secret exposure only, NOT plan-quality or stale-entity judgment**; Critic prompt template (adversarial reviewer persona: "find any credential, secret, or sensitive value that should not be forwarded to an external provider"); adversarial confidence threshold (≥80 points to pass; below 80 → halt + structured NDJSON event with `security_class: layer2_critic_flag`); Critic output schema (`{ passed: bool, confidence: int, findings: string[] }`); escalation contract when Critic flags (delegation halted, user-visible footnote per Domain Requirements §Layer 2 wording); Critic call latency cap (≤5s; timeout → fail-closed, not fail-open); **AC-CRITIC-1 verification harness contract**: net-new classifier-evaluation harness (labeled-corpus loader + confusion-matrix scorer) built as an architectural sibling of AC-1's harness (shared CI integration + fixture conventions, NOT a reuse of AC-1's presence-assertion harness); fixed 25-UNSAFE/25-SAFE template-generated corpus with deterministic committed ground-truth labels; pass bar (≥23/25 catch, ≤2/25 FP) MUST hold on every CI run. **Effort is sized when this stub is authored — not estimated before.** | FR33, FR34, FR-CRITIC-1 | **Yes — Sprint 2** (Layer 2 enforcement mechanism; without this spec NFR-S1 has no verified second-pass enforcement point beyond the static pattern scan) |
| TS-REWARD-1 | `t3_confidence` probabilistic field on every T3 reward event — scoring formula (starts at 1.0, attenuated by active conditions), 6 attenuation conditions: (1) squash-merge blur (linear history rewrites parent SHA → attribution window may be wrong; attenuate by −0.3), (2) rename heuristic failure (file moved but `git diff --find-renames` threshold not met → file-path attribution broken; attenuate by −0.25), (3) autonomous-rebase contamination (Symphony or similar rebasing tool shifts commit SHAs; attenuate by −0.2 when rebase detected), (4) A′ approximation → async T3 (T3 collected before full attribution window closes → provisional; attenuate by −0.15 until window closes), (5) 30% Ollama noisy-neighbor run-to-run variance (variance masks true capability signal; for Ollama arm: attenuate by −0.15 per standard deviation above baseline), (6) legacy contamination (reversion gap >14d → intervening commits contaminate attribution; attenuate by −0.3); interaction with Q-update: T3 reward weight = `t3_weight × t3_confidence`; below `t3_confidence < 0.4`, T3 signal is excluded from Q-update entirely | FR16, FR17 | **Yes — Sprint 2** (without probabilistic attenuation the bandit over-rewards noisy git patterns and under-penalizes truly bad outputs; 6 failure modes confirmed by NLM research) |

## Innovation & Novel Patterns

### Detected Innovation Areas

**RL-Based Routing with Local Git Signal (T3)**
Multi-provider LLM routing with learned preferences is prior art (RouteLLM, Lmsys, mid-2024). What Metis does that RouteLLM cannot: use T3 — the reversion signal derived from local git history — as a delayed reward input. Cloud-based routing systems require a local agent to observe post-hoc git outcomes. Metis's T3 structural moat is that no cloud system can observe local git history without deploying a local agent, which is the same problem Metis already solves. This is not a claim that routing ML is novel — it is a claim that **this specific composition (bandit + local git outcome signal + per-repo per-task-type state) has not been productized in developer tooling**.

**Primary Technical Bet: Thompson Sampling Cold-Start Window**
The most technically fragile claim is convergence speed for a solo developer. With ~15 arms (providers × task types) and 10–20 observations needed per arm for meaningful differentiation, the cold-start window is near-random. The PRD holds this claim honestly: **Thompson Sampling convergence must be validated in a controlled prototype before AC-2 gate testing begins.** If convergence is too slow for solo use, the design falls back to a simpler heuristic. This validation is a Sprint 2 precondition.

**Per-provider native dialect — load-bearing constraint:** Each provider must be invoked in its native interaction pattern — not via a unified wrapper that flattens the differences. Claude responds best to conversational prompting with tool use; Codex responds best to structured code-completion prompts; Copilot CLI is a spawn-based command interface; Ollama requires HTTP with model-specific system prompt tuning. A wrapper that normalizes these differences destroys the harness-fit signal. This is a primary technical constraint, not a stylistic preference: the citation-discipline pillar of the four-pillar moat depends on each provider being invoked in its native dialect so that performance variance is attributed to model capability, not harness mismatch.

**Co-evolution feedback loop:** The bandit and memory layer improve together. As the bandit learns which providers work well for which task classes in this codebase, the memory layer captures the outcomes as entity summaries and evolving beliefs. Subsequent routing decisions consult both the bandit (statistical preference) and the memory layer (codebase-specific context). This co-evolution creates compounding value: a developer at invocation 200 benefits from 200 data points of combined routing and memory signal. A competitor starting today cannot replicate that state without 200 real invocations in the same codebase.

**First-Time Value vs. Accumulated Value**
Metis must deliver value at two distinct moments: day 1 (install decision, no RL history, self-review blindness risk) and invocation 200 (RL compounding visible, churn decision). The current design addresses day 1 through Q_INIT_PRIORS and zero-config startup. Accumulated value depends entirely on whether the RL signal is visible to the developer — which motivates AC-4 below.

### Market Context & Competitive Landscape

Prior art: RouteLLM (Lmsys, mid-2024) — ML-driven routing between LLMs using preference labels. Distinct from Metis in three ways: preference labels are human-rated (not git-derived), routing is cloud-operated (no per-repo state), and it targets inference cost reduction (not developer workflow). No identified prior art uses local git reversion as a reward signal.

**Memory architecture — recommended implementation path:** The four-network memory layer uses a **hybrid architecture**: (1) `agentmemory` MCP server handles `world_facts` and `entity_summaries` networks — it provides BM25+vector+graph retrieval, 4-tier async consolidation (Working → Episodic → Semantic → Procedural), and Ebbinghaus decay out of the box; (2) custom SQLite (`metis.db`) handles bandit arms, Q-values, T3 signals, `agent_experiences`, and `evolving_beliefs` — these require custom schema and update logic that general-purpose memory MCPs cannot provide. This hybrid splits responsibilities by what each system does best: agentmemory for general retrieval and consolidation; custom SQLite for RL-specific state and routing tables. Architecture spec (which MCP tools map to which networks, synchronization contract between the two stores) lives in the architecture document.

Honest caveat: demand-side validation has not been conducted. The hypothesis that developers experience multi-model routing as a meaningful pain point requires primary research. The 8–10 month convergence window for a solo developer is an estimate that must be tested in prototype.

**Anthropic risk**: If Claude's tool-use API gains native multi-provider orchestration, Metis's routing layer becomes redundant. The structural hedge is T3 — git-derived outcome signal remains valuable independent of which LLMs are being routed.

### Validation Approach

1. **Thompson Sampling prototype**: Simulate convergence with synthetic task-type distributions before committing to bandit design. Sprint 2 precondition.
2. **AC-1 credential safety**: Zero secret values in any provider API payload across 100 test invocations.
3. **AC-4 Visible Learning**: A developer who has completed 20 invocations can explain, without reading documentation, why Metis made its last routing decision. Measured by: visible routing rationale surface in CLI output (provider name + confidence tier + last-decision signal).
4. **T3 attribution accuracy**: Reversion correctly attributed in ≥80% of cases in a test repo with known reversion commits.

### Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Thompson Sampling too slow for solo dev | Prototype validation Sprint 2; heuristic fallback if convergence >6 months |
| T3 false attribution | File-path + time-window attribution fallback; reflect() diff-based (not commit-message-dependent) |
| Anthropic platform risk (8–10 month window) | T3 structural moat; per-repo state not replicable by cloud routing |
| Demand-side gap | Primary research before public launch; v1 validates with early-access cohort |
| AC-4 failure (invisible RL) | Visible routing signal spec required in Sprint 1 CLI design |
| Plugin-layer citation/decay ceiling | Plugin layer cannot observe per-provider citation rates or memory decay signals directly — structural ceiling. Mitigated by: T2/T3 proxy signals as indirect outcome measures; Critic side-query (§TS-SECURITY-1) as a partial quality proxy; acknowledged in §TS-REWARD-1 attenuation model |
| Supply chain threats (SKILL.md injection, credential harvester, dialect poisoning) | Malicious SKILL.md files or injected context can attempt to redirect delegation, harvest credentials from injected context, or poison dialect formatting. Mitigated by: two-layer blocklist (Layer 1 at task intake, Layer 2 Critic pre-forward); JSONC config `additionalProperties: false` schema validation with error-as-result pattern; `doctor` command for config integrity check |
| T3 probabilistic attenuation (6 failure modes) | T3 attribution has 6 documented failure modes (squash-merge blur, rename heuristic failure, autonomous-rebase contamination, async attribution window, Ollama noisy-neighbor variance, legacy contamination >14d). Using raw binary T3 signals would corrupt Q-values. Mitigated by: `t3_confidence` field (§TS-REWARD-1) attenuating Q-update weight proportionally; signals below 0.4 confidence excluded entirely from Q-update |

## Developer Tool Specific Requirements

### Project-Type Overview

Metis is a Claude Code plugin distributed via the Claude Code marketplace. The API surface is intentionally minimal: five user-facing slash commands (`/metis:do` plus introspection and one destructive verb) and Ctrl+C for graceful abort, with an optional plan-confirmation gate configurable via a single repo-scoped JSONC file.

**Thesis:** The optional plan-confirmation gate is the product's central learnable surface. A user who runs `/metis:do` sees either silent delegation (when the gate is off or annotation passes clean) or a reviewable plan card before any code is written. Everything else in this section — distribution mechanics, the supporting commands, settings, telemetry — exists to support that one interaction. The probabilistic routing model (Innovation §Primary Technical Bet) learns from the outcomes of those interactions; the developer learns from seeing the plan they would have written if they'd had the energy.

### Technical Architecture

**Language & Runtime Matrix**

| Item | Decision | Notes |
|---|---|---|
| Runtime | Node.js ≥18 | Pinned `engines.node: ">=18"`; matches Runtime Contracts §Runtime floor |
| CI node matrix | Node 18 LTS, Node 20 LTS | Catches lower-bound regressions |
| TypeScript target | ES2022 | Native to Node ≥18 |
| Module system | CommonJS | ESM interop with Claude Code plugin loader unverified |
| `tsconfig` | `target: ES2022`, `module: CommonJS`, `moduleResolution: Node` | |
| Non-Node runtimes | None for v1 | Bun, Deno: out of scope |

The command layer decoupling NFR is locked in Domain Requirements §Runtime Contracts. Stories MUST NOT introduce coupling between provider/routing logic and the Claude Code command layer.

### Distribution & Installation

**v1 ships dual distribution, single init script.**

| Path | Audience | Mechanism |
|---|---|---|
| Claude Code marketplace (canonical) | End users | `claude plugin install metis` → marketplace handles file placement |
| Clone + `install.sh` (fallback/dev) | Contributors, pre-marketplace dogfooding | `git clone … && ./install.sh` → copies plugin files into `.claude/plugins/metis/` |

Both paths invoke the same `scripts/init.sh` post-install hook declared in `plugin.json`. The hook:

1. Initializes SQLite at `.claude/plugins/metis/metis.db` (DDL + `PRAGMA journal_mode=WAL`)
2. Creates `~/.metis/debug/` directory for NDJSON logs (Domain Requirements §Structured debug log)
3. Seeds bandit `Q_INIT_PRIORS`
4. Idempotent — re-running on update is a no-op via `CREATE TABLE IF NOT EXISTS`

Plugin layout MUST conform to Claude Code marketplace manifest requirements (pinned in §TS-1.9 — new).

**NFR-INSTALL-1 (Install Path) [v1]:** Global `npm install -g metis` is the **primary install path**. The marketplace `claude plugin install metis` path remains the canonical end-user path. `npx metis` is documented as a fallback but is NOT recommended as default — npx cold-cache invocation exceeds Claude Code's 30s MCP_TIMEOUT, which causes the plugin to fail to load on first use. Any documentation, README, or onboarding flow MUST lead with the global install instruction, not npx.

**Acceptance criteria:**
- **AC-INSTALL-1:** Marketplace path → `metis.db` exists at expected path, schema matches pinned golden file.
- **AC-INSTALL-2:** Clone path → same assertions.
- **AC-INSTALL-3:** Re-running install on existing install → no data loss, schema migration runs if version delta (Domain Requirements §Atomic schema migration).
- **AC-INSTALL-4:** `npm install -g metis` completes and `metis.db` is initialized within 30s on a cold npm cache. `npx metis` is not used in any CI or automated test that asserts on MCP_TIMEOUT compliance.

### Command Surface (v1)

Design rule: *Commands are for user-initiated interactions that need a verb. Artifacts (NDJSON log) and lifecycle hooks (`reflect()` on startup) are NOT commands.*

Command-surface principle: every entry is a genuine user-initiated verb. Control-plane operations (abort), maintenance jobs (disk-cap trimming), and lifecycle hooks (`reflect()`) are NOT commands — they are reclassified to their correct mechanism below the table.

| Command | Purpose | AC Implication |
|---|---|---|
| `/metis:do <task>` | Delegate task to routed provider | Core flow; see Plan-Confirmation below |
| `/metis:why` | Explain last routing decision (reads `invocations` table) | **AC-4 (Visible Learning) — post-hoc surface.** Shares layout vocabulary with plan card. Output header anchors to last `:do` (e.g., `Why · 2 min ago · "fix the auth bug"`). Routing rationale MUST surface all four criteria that drove the decision: (1) **scope** — task type inferred and which providers were eligible; (2) **harness-fit** — which providers are native-dialect-compatible for this task type; (3) **cost/latency** — cost-class and latency tier of the selected vs. available providers; (4) **context health** — whether memory context was available and influenced the decision, including `t3_confidence` score if T3 signal was active. Manual T3 correction (`--bad`) for ambiguous-history cases is a v1.1 surface (see v1.1 backlog) — v1 T3 attribution is conservative (attributes nothing rather than wrong) on rewritten history. |
| `/metis:status` | **Cold-return state readout** — five dimensions displayed: (1) **Runtime health**: current `plan_confirmation.mode`, provider chain status (which providers are credentialed and reachable); (2) **Routing decisions**: last 5 routing decisions (provider + task type + accept/reject/abort), running accept-rate counter; (3) **Memory health**: one-line legibility surface per network (e.g., *"47 files summarized, 12 patterns observed, 3 strong beliefs (top: 'tests live alongside source'). Last updated: 2h ago."*), total injection budget used vs. ≤1,900 token target; (4) **Economic telemetry**: cost-class breakdown across last 20 invocations (`[free]`/`[metered]`/`[paid]` distribution), TTFT/TPS per provider arm; (5) **Learning progress**: observation count per arm, arms above minimum probe threshold (8–12 general / 30 Ollama), `t3_confidence` p50 trend. | Worker glance, NOT tinkerer dashboard. Explicitly excludes bandit Q-values, posterior dumps, or routing internals (those remain debug-log territory). Serves the 2-week cold-return job AND the AC-5 legibility requirement. Replaces the `sqlite3 / jq / cat` archaeology path. Snapshot test pinned. |
| `/metis:help` | Inline help (≤20 lines); first-time `[?]` is educational, not just key legend | Exits 0; stdout snapshot pinned; MUST contain `Usage: /metis:do <task>` |
| `/metis:forget` | Single destructive concept with four-tier deletion targeting. Prompts: *"What should I forget? [all / network / old / belief]"*. Tiers: (1) `all` = wipe all bandit state + all four memory networks for this repo; (2) `network=<name>` = wipe a single memory network (`agent_experiences`, `world_facts`, `entity_summaries`, or `evolving_beliefs`) while preserving the others and the bandit state; (3) `old` = trim records older than N days (default 90), optional `--network=<name>` granularity; (4) `belief=<pattern>` = delete specific evolving beliefs matching a substring pattern. Replaces the former `/metis:reset` + `/metis:prune` pair. **Governance:** before any destructive operation, Metis MUST (a) show exactly what will be destroyed (row counts, age range, top-3 examples), (b) write a git-snapshottable audit event to the NDJSON debug log (`{ event: "forget", tier, scope, rows_deleted, timestamp }`), and (c) require `[!]` confirmation key (NOT `[r]`). **Git snapshot requirement:** before a `tier=all` operation, Metis prompts: *"Recommended: commit or stash any in-progress work before wiping routing state — this cannot be undone."* | **Confirm key:** `[!]`. MUST show exactly what is destroyed before destruction. |

**Reclassified — NOT commands:**

- **Abort → Ctrl+C, not `/metis:abort`.** Abort is needed precisely when `/metis:do` is running and owns the input line — a slash command is un-typable in that moment. The contract: Ctrl+C during a `/metis:do` run triggers in-process graceful cancellation (close in-flight provider calls, finalize or roll back the partial memory write transactionally, record a `recorded-but-statistically-silent` `aborted` terminal — never a corrupt partial, never an erased record). If the process dies hard before cleanup, the next `/metis:do` startup runs the ordered sequence stale-lock heal → orphan reconciliation (lease/heartbeat expiry) → `reflect()`, reconciling the orphaned in-flight record deterministically before T3 detection runs. A documented narrow `/metis:abort` MAY exist solely as a second-terminal cross-session escape hatch ("kill the run I left going elsewhere"); it is not the primary abort path. This contract is load-bearing for NFR-R2/R3/R5 and is specified in §TS-1.16.
- **Disk-cap trimming → automatic (NFR-R8).** The user almost never *wants* to prune; the disk cap summons the need. Automatic trimming under NFR-R8 plus the manual `/metis:forget old` path together serve the job; there is no standalone `prune` verb.
- **`reflect()` → startup lifecycle hook**, not a command (unchanged).

Command-surface rationale: this set was reconsidered from first principles (not defended as accreted). The front family (`do` / `why` / `status` / `help`) is a self-teaching vocabulary — the user meets each word at the moment of need (`do` output offers `why`; cold return motivates `status`). `forget` collapses two destructive verbs into one safe concept. Abort, disk-trimming, and `reflect()` were each found to be a non-command wearing a command costume and reclassified to their correct mechanism.

**AC-4 has two surfaces, not one:**
- **`/metis:why`** — post-hoc, on demand. Required.
- **Plan card** (when plan_confirmation is on) — surfaces provider reasoning BEFORE execution. Stronger AC-4 affordance; the 20/20 alignment with the off-ramp threshold is intentional choreography (user reaches AC-4 fluency by invocation 20, off-ramp triggers at 20).

### Plan-Confirmation Feature

Optional pre-execution gate where the routed provider produces a plan, Metis annotates it via heuristic scan, the user reviews and accepts/rejects, then execution proceeds. Default: `risky-only`.

#### Provider-Adapter Contract

Each adapter implements (both methods take an `AbortSignal` — see NFR-I1, the authoritative signature; the execute phase MUST be cancellable for the §TS-1.16 abort contract to hold):
```
generate_plan(task, signal: AbortSignal) → Promise<Plan>
execute(task, approved_plan, signal: AbortSignal) → Promise<Result>
```

Full schema for the `Plan` object (fields, types, required/optional) lives in §TS-1.10 (new — added by this section). The PRD requires that the plan surface at minimum: intended files (path + estimated lines added/removed), approach (numbered steps), and annotation findings (see below).

Native planners (Claude Agent tool, Codex) call planning APIs directly. Adapters without native plan mode (Copilot CLI, Ollama) emulate via structured-output prompts. **Plan-and-code interception (the alternative) is rejected** — pre-execution side effects in file-write tools make it a non-starter.

**Latency budget:** Plan generation MUST complete within 20 seconds (soft target) for cloud providers, 30 seconds for Ollama. Visible elapsed counter (`metis › claude-sonnet · planning… 7s`) renders during wait — silent spinners breed anxiety. Plans exceeding length cap (~150 lines) are rejected at annotation time; provider is asked to scope down.

#### Plan Annotation (Heuristic Scan — Pure-Heuristic in v1)

Not LLM-as-judge. Heuristic scan over plan text via the unified pattern registry (Domain Requirements §Plan annotation reuses the two-layer blocklist). Plan-specific patterns extend — never replace — the credential pattern set. Examples of plan-specific patterns: `rm -rf`, `git push --force`, `DROP TABLE`, package installs, network egress paths, deletes >N files.

**v1 scope: annotation is pure-heuristic.** Annotation does NOT read from the four-network memory in v1 — this decouples the plan-confirmation feature from the memory critical path and prevents schedule entanglement during Sprint 2. Memory-aware annotation (where world facts, entity summaries, or evolving beliefs influence annotation severity) is **v1.1**.

**Plan-confirmation gate — sync-first / async-Critic-subsequent model:**

- **First delegation per session + all high-blast-radius tasks** (≥5 files touched, schema-altering SQL, `git push`, `rm -rf` or equivalent destructive patterns): gate is **synchronous** — plan card renders and blocks execution until user acts. No async path.
- **Subsequent delegations within session (low-blast-radius):** gate is **async Critic**: the Critic sub-agent (§TS-SECURITY-1) performs adversarial verification concurrently with plan generation. If Critic confidence ≥80pt, plan proceeds with single-line receipt. If Critic confidence <80pt, full plan card surfaces synchronously.
- **Rationale:** Sync-first establishes trust on the first interaction where the user has no prior context about what the plan will look like. Async-Critic-subsequent respects user time after trust is established.

**Critic sub-agent — credential/secret exposure only.** The async-Critic path above invokes the Critic sub-agent, whose binding definition is **FR-CRITIC-1** (Functional Requirements §Security & Credential Protection) and whose ship-gate is **AC-CRITIC-1** (Success Criteria §Measurable Outcomes). Its remit is deliberately narrow: credential and secret exposure only. It does NOT judge plan quality, scope creep, or general "destructiveness" (that is FR8's pure-heuristic concern) and it does NOT detect stale entities (the Stale Entity Validator below owns that, deterministically). The ≥80-point confidence gate, the structured verdict schema, and the latency cap are specified in §TS-SECURITY-1; the 25/25 synthetic-corpus acceptance bar is specified in AC-CRITIC-1. This section does not re-define them — FR-CRITIC-1 and AC-CRITIC-1 are the single source of truth.

#### Stale Entity Validation (v1 — Non-Negotiable)

Before rendering the plan card, Metis MUST validate every entity reference in the plan against the current code state. If the plan refers to `getUserById` and the function has been deleted or renamed since the entity summary was cached, the plan card MUST surface this as an annotation finding — never silently render a plan that references refactored-away entities. Failure mode without this validation: the user sees a plan card that confidently proposes work against entities that don't exist, accepts it, and Metis fails embarrassingly. Trust does not recover from this scene. The validator runs at plan-generation time and re-checks on each plan card render (cheap — read mtime + grep symbol).

Findings render as a "Risks Metis flagged" section on the plan card. If any flag fires while mode is `risky-only`, the gate auto-engages.

Terminology lock: this feature is called **plan annotation (heuristic scan)** throughout. "Self-review" is not used. "Heuristic scan" is the mechanism; "plan annotation" is the surface.

#### Plan Card UX

*Illustrative — final visual TBD by UX spec. Required content elements (not visual style) are normative.*

```
─── Metis plan · provider: <name> · annotation: <ok | risk-flagged> ───

Goal
  <one-line restatement>

Files
  <change list with rough line counts>

Approach
  <numbered steps>

Risks Metis flagged
  <findings or "none">

[a]ccept  [r]eject  [e]dit  [d]etails  [?]help
```

**Required content elements (normative):**
- Provider attribution (which adapter produced this plan)
- Annotation status: `ok` (clean) or `risk-flagged` (one or more patterns hit)
- Intended files with change-size estimates
- Approach as numbered steps
- Risks Metis flagged (or "none")
- Accept / reject / edit / details / help affordances

**Interaction rules (normative):**

| Key | Behavior |
|---|---|
| `[a]` | Accept plan; proceed to `execute(approved_plan)` |
| `[r]` | Reject plan; trigger reroute flow (see below) |
| `[e]` | Edit task description and resubmit (plan discarded; new `generate_plan` call) |
| `[d]` | Expand details — render per-file pseudocode or full plan text if originally truncated |
| `[?]` | First-time: educational (~6 lines explaining what the card is and why it appeared). Returning users: key legend. |
| `Enter` | No-op. Never silently accepts. Renders `metis: press a key from [a/r/e/d/?]`. |
| `Ctrl+C` | Abort. Prints receipt: `metis: cancelled, no provider called, no state changed`. Null signal — no reward/penalty recorded. |

**Input-lockout visualization:** 250ms post-render lockout MUST be visible (e.g., subtle dim on the affordance line until lockout clears). Silent input swallowing is forbidden.

**When `plan_confirmation` is OFF or annotation passes clean (mode `risky-only`):** Single-line receipt scrolls past before execution. The receipt MUST include the affordance whisper `· plan ✓` so the word "plan" enters the user's peripheral vocabulary before any plan card ever appears:
```
metis › <provider> · plan ✓ · 3 files · executing…
```
The plan is folded, not hidden. `/metis:why` surfaces it post-hoc. **Override:** if annotation flags risk, Metis surfaces the full plan card EVEN WHEN mode is `off`. The setting means "skip the gate when things look fine," not "shut up no matter what."

#### Reject Path

`[r]eject` → optional one-line "why?" prompt → reroute to next-best provider with rejection reason injected into new context.

**Reroute cap: 2.** After the second rejection, control returns to the shell with explicit dead-end message:
```
metis: 2 plans rejected on this task. Want to refine the task description ([e]dit)
or stop here ([q]uit)? See /metis:help for more options.
```

Fall-through after a fully exhausted reroute chain follows Full Chain Exhaustion handling (User Journeys §Journey 6).

#### Reward Signal (Conservative)

| Outcome | `failure_class` | `signal_class` | Q-update behavior |
|---|---|---|---|
| Accept | (none) | (none) | 0 reward at accept; real reward arrives via T1/T2/T3 downstream |
| Reject | `plan_rejected` | **`preference`** | **Does NOT decrement Q.** Increments per-arm `rejected_count` for diagnostic surfacing. Routes to replan policy, not fallback chain. No cross-provider contamination — rerouted provider B starts clean. |
| Edit-then-accept | `plan_modified` | **`correction`** | **Does NOT decrement Q.** Increments per-arm `modified_count`. Diff between proposed and accepted plan persisted for v1.1 plan-quality regression. Highest-information user action — the proposed plan was directionally right but needed correction. |
| Abort (Ctrl+C) of a **responsive** delegation | `aborted` | **`aborted`** | **Recorded but statistically silent.** The delegation row IS persisted with terminal state `aborted` (required for orphan reconciliation per FR32d and for `/metis:why` to explain it) — it is NOT erased. But `aborted` is excluded from the Q-update entirely: no decrement, no reward, no reliability down-weight. Analogous to `preference`/`correction` — the record exists for diagnostics and recovery; it contributes zero to the bandit. *"No reward/penalty signal" means zero contribution to learning, not zero record.* |
| Abort (Ctrl+C) of a delegation already **past the unresponsiveness threshold** (provider call hung, not responding) | `provider_timeout` | **`fault`** | **Standard Q-decrement.** `aborted` is reserved for user-intent cancellation of a *responsive* delegation. If the user aborts a provider call that is already hung past the unresponsiveness threshold (default: the per-provider 300s timeout's early-detection window — exact threshold in §TS-1.16), the outcome is classified `provider_timeout`/`fault`, NOT `aborted`. Rationale: a hanging provider is exactly what the bandit must learn to avoid; routing a Ctrl+C-on-a-hang as silent `aborted` would let user reflex erase the precise fault signal. The classification boundary is determined by provider responsiveness at abort time, not by which key the user pressed. |
| `generate_plan` fails (`always` mode) | `provider_timeout` / `provider_unavailable` / etc. | `fault` | Fail closed; standard Q-decrement |
| `generate_plan` fails (`risky-only` mode) | reliability log only | `fault` | Fail open + log; arm reliability down-weighted (separate axis from reward) |
| `generate_plan` succeeds but `execute` fails | standard execution `failure_class` (e.g. `validation_failure`, `provider_timeout`) | `fault` | Standard Q-decrement. **NOT `plan_rejected`** — reject is a user act, not a system act. |

**Critical:** `plan_rejected` MUST be routed as `signal_class: preference` (per Domain Requirements §Credential Trust Boundary — signal_class taxonomy). Routing it as `signal_class: fault` mixes preference signals into the fault-trained bandit and poisons credit assignment. The bandit will learn to avoid plans the user *would have approved* because some adjacent plan got rejected for unrelated reasons. This is one of the load-bearing distinctions in v1's RL design.

**Preserves the T1/T2/T3 30/30/40 weighting locked in Success Criteria.** No T0 introduced. The plan-confirmation feature is statistically silent on accept — disabling it does not change the reward math, only removes downward pressure on arms that produce rejectable plans.

**Reversion counter (on-ramp trigger) vs T3 reward signal:** Same underlying event (git reversion detected by `reflect()`), different aggregations. T3 feeds the bandit per-arm. The on-ramp counter aggregates across all arms in the rolling window. A reversion increments both.

#### Off-Ramp & On-Ramp — Asymmetric Stakes Split

On-ramp and off-ramp are NOT symmetric jobs. They serve opposite users at opposite trust levels with opposite failure-mode costs. The PRD unbundles them.

**v1 — On-ramp banner (safety feature, asymmetric stakes mandate)**

| Trigger | Surface | Rationale |
|---|---|---|
| Last 10 invocations on this repo, ≥3 T3 reversions OR ≥2 post-execute rollbacks | Banner permitted (interruption justified by stakes). Wording acknowledges prior choice: "You turned plan confirmation off — want to reconsider for risky operations only?" | Wrong-by-excluding = catastrophic and silent (bandit decrementing in the dark, user loses code/trust before realizing there's a brake). Wrong-by-including = dismissible banner. Ship even the guessed threshold — the cost asymmetry mandates it. |

**On-ramp wording principle:** Metis says *"I noticed something. You decide."* — never *"I'm turning this back on for you."* The banner appears once per qualifying event and respects the user's prior choice in the language. Dismissal silences for N invocations (TBD by telemetry).

**v1 — Off-ramp discoverability via always-on footer hint (NOT threshold prompt)**

After every accepted invocation, plan-confirmation appends a single quiet line to the receipt:
```
metis › <provider> · plan ✓ · 3 files · executing…
  (disable plan_confirmation in .metis/config.jsonc · see /metis:status)
```

Always-on, never wrong-tuned, no threshold to guess. Discovery by osmosis: by invocation 20, the user has seen the lever 20 times. Veterans graduate by finding the setting — that's the v1 graduation mechanism.

**Confidence degradation warning (v1):** When the routing system detects degrading `t3_confidence` across recent invocations (rolling 10-invocation p50 below 0.5, indicating unreliable T3 attribution), `/metis:status` surfaces a one-line context-anxiety signal: `~ routing confidence degraded · T3 attribution unreliable · reason: <top attenuation condition>`. This is NOT an error — it is an honest calibration signal. Users can inspect via `/metis:why` to see which attenuation condition is dominant.

**Provider bypass (v1):** `/metis:do <task> --provider=claude` forces delegation to Claude regardless of bandit routing. Intended for: user-initiated escape hatch when routing is clearly wrong, debugging, and tasks where the user has strong provider preference. Bypass events are recorded with `signal_class: preference` and are NOT used to update Q-values (bypass is user override, not a capability signal). The `--provider` flag is the only supported override; there is no `--no-route` or equivalent.

**v1.1 — Off-ramp threshold suggestion prompt (deferred)**

The contextual prompt at "20 clean accepts + zero rejects + no-arm-rejected" is **explicitly v1.1.** The threshold is a guess; shipping a wrong-tuned automated suggestion erodes trust worse than shipping no automated suggestion at all (banner blindness — "there it goes again, telling me to switch modes" — kills the learning surface). Telemetry collection (`invocations` table) stays in v1; v1.1 ships the smart threshold prompt informed by dogfood data.

**Off-ramp vs AC-2 disambiguation:** v1 off-ramp discoverability is always-on (no threshold). v1.1 off-ramp threshold (20 clean) is orthogonal to AC-2's 50 (eligible delegations for the RL bandit-trust gate). User-trust and bandit-trust converge at different rates and serve different functions.

#### Telemetry (Required Before Heuristic Ship)

SQLite `invocations` table tracks: `ts` (unix ms), `command` ("do" | "why" | …), `plan_hash` (SHA-256 of the plan body or null), `decision` ("accept" | "reject" | "timeout" | null), `failure_class` (or null), `risky` (0/1 — did annotation flag fire). Without this telemetry the 20-clean-accepts threshold remains gut feel.

### Settings & Configuration

**Format: JSONC** (JSON with comments). Parser: `jsonc-parser` (~50KB, zero transitive deps, maintained by Microsoft for VS Code's settings layer and TypeScript's tsconfig). Format-migration to alternative is in §Explicitly Out of Scope below as a v2 watch item.

**Locations (precedence, highest first):**

1. **CLI flag** (per-invocation): `/metis:do --confirm` / `--no-confirm`
2. **Per-repo:** `.metis/config.jsonc` (at repo root, outside plugin dir so marketplace updates can't clobber)
3. **Per-user global:** `~/.metis/config.jsonc`
4. **Built-in defaults** (hardcoded)

**Merge rule:** Top-level key replace, not deep-merge. If a layer names a key, that layer's value for that key is authoritative. Predictable; no "the array came back from global" surprises.

**Schema source of truth:** Zod (TS types via `z.infer`, runtime validation built-in). JSON Schema generated via `zod-to-json-schema` and shipped in plugin. `$schema` reference at top of config file enables autocomplete in VS Code, Cursor, Zed, JetBrains.

**Graduated validation:**
- File missing → use defaults silently (common case)
- Syntax error → fail closed, print line/col, exit non-zero
- Valid syntax, unknown key → warn and continue (forward-compat)
- Valid syntax, invalid value for known key → fall back to default for that key + warn loudly. NEVER silently ignore a value the user actively wrote.

**SQLite vs config file separation:**

| Storage | Contents |
|---|---|
| `metis.db` (SQLite) | Machine state: bandit posteriors, decisions, invocations, schema version |
| `.metis/config.jsonc` + `~/.metis/config.jsonc` | Human intent: settings, version-controllable, diffable, survives reinstall |

**Example `.metis/config.jsonc`:**
```jsonc
{
  "$schema": "https://metis.dev/schema/config-v1.json",
  "plan_confirmation": {
    "mode": "risky-only",          // "always" | "risky-only" | "off"
    "auto_disable_after": 20,      // null disables off-ramp suggestion
    "risky": {
      // Plan-specific patterns extend the credential blocklist registry
      "commands": ["rm -rf", "git push --force", "DROP TABLE"],
      "paths": ["**/.env*", "**/secrets/**"]
    }
  }
}
```

Default `plan_confirmation.mode` is `"risky-only"`. No first-run modal — ship the sane default, document the knob in `/metis:help`.

### Documentation Surface

Three layers, no more:

1. **`/metis:help`** (inline, ≤20 lines): invocation syntax, one-line description per provider, link to README, mention of `.metis/config.jsonc` knob.
2. **`README.md`**: target reader is a competent developer who has never heard of Metis. Sections: what Metis is (one paragraph), installation, single command with 3–5 worked examples, how routing decisions are made, how to read the debug log.
3. **Inline JSDoc on public interfaces**: for the next developer who touches the RL logic. The Thompson Sampling bandit implementation requires a "why does this exist" comment block.

Out of scope: dedicated docs site, OpenAPI spec, wiki.

### Code Examples

3–5 commented one-liners in `README.md` only — no separate `examples/` directory. Examples serve dual purpose: documentation + shaping user inputs toward phrasings that produce strong T1/T2 reward signals. Placed immediately after installation steps.

### Explicitly Out of Scope for v1

Items a reader might reasonably expect that are deliberately deferred or refused, with one-line rationale. (Cross-cutting product decisions are recorded separately in the Decision Log appendix.)

| Item | Why not |
|---|---|
| `/metis:status` (full tinkerer dashboard with bandit Q-values, posteriors, full decision history) | v1 ships the *minimal* `/metis:status` (mode + last 5 decisions + accept-rate). The full dashboard is v1.1 if dogfooding shows demand. Bandit internals belong in the debug log, not a user surface. |
| Off-ramp suggestion prompt at threshold (20 clean accepts) | Threshold is a guess without dogfood telemetry. Wrong-tuned automated suggestions erode trust worse than no automated suggestions (banner blindness). v1 ships the always-on footer hint + telemetry collection; v1.1 adds the smart threshold prompt informed by real data. |
| `/metis:reflect` (manual reflect trigger) | `reflect()` already runs on startup. Manual trigger is a dev-debug ergonomic dressed as a user command. |
| `/metis:debug` (NDJSON log dump) | Log lives at a known path; `cat`/`jq` is the right tool. Document the path in `/metis:help`. |
| `/metis:undo` | Conceptually adjacent (the on-ramp counter implies the system knows what a reversion is), but no clean reversal primitive exists in v1. Flagged for v2 vocabulary. |
| Conditional T0 reward (plan-accept × downstream T2 success) | Rubber-stamp risk and renormalization cost outweigh signal value in v1. Revisit if telemetry shows accept-correlated outcome differences across arms. |
| Cross-repo off-ramp ("disable globally?") | Premature without multi-repo telemetry. Instrument first. |
| npm package distribution | Marketplace is canonical for v1. Revisit if marketplace adoption gaps appear. |
| Plan editing / templates / history / cross-arm plan diffs | The "camel's nose" extensions. Ship the core gate first. |
| ESM module system | Claude Code plugin loader ESM behavior unverified. CommonJS is the safe default. |
| Settings format migration (JSONC → alternative) | JSONC is the v1 bet. Revisit if user feedback indicates JSONC ergonomics insufficient. |
| Bun, Deno, browser, or any non-Node runtime | Out of scope. No current consumer. |
| **VS Code, JetBrains, or any non-Claude-Code IDE surface** | Not v1, not v2. Locked as Executive Summary non-goal. A multi-IDE story is a different product, not a different release. |

### Open Implementation Items (Flagged for §TS-1)

The PRD does not specify the following; the tech spec must resolve them before Sprint 2:

- **§TS-1.9**: Claude Code marketplace manifest schema and validation
- **§TS-1.10 (sprint-blocking)**: `Plan` object schema + plan-flow state machine
- **§TS-1.11 (sprint-blocking)**: Plan annotation pattern registry (unified with credential blocklist, scope tag, CI lint contract)
- **§TS-1.12**: Dismissal-history state model (where it lives, retention, reset semantics)
- **§TS-1.13 (sprint-blocking)**: Belief-strength scoring contract for `evolving_beliefs` (formula, update rule, invalidation triggers, eviction threshold)
- **§TS-1.14**: Context-injection token-budget allocator (priority order, truncation policy)
- **§TS-1.15 (sprint-blocking)**: Memory write-path triggers and idempotency contract — per-network write events, throttling, idempotency keys, failure isolation
- **§TS-1.16 (sprint-blocking)**: `/metis:do` cancellation + startup-reconciliation contract — Ctrl+C graceful abort, cancellable provider calls, transactional state mutations, `aborted` reward terminal state, orphaned-record lease reconciliation

The 14-value `failure_class` enum (including `plan_rejected`, `plan_modified`, and `aborted`) consolidates into §TS-1.4 — already a sprint-2 deliverable.

## Functional Requirements

*This is the binding capability contract for v1. Any feature not listed here will not exist in v1 unless explicitly added. UX design, architecture, and epic breakdown all trace back to these FRs.*

### Task Delegation

- **FR1**: Developer can delegate a coding task to Metis via a single command, providing only the task description as natural language.
- **FR2**: Metis can infer the task type from the task description and assign a confidence value in [0, 1] sourced from a defined classification mechanism.
- **FR3**: Metis can select a provider for the delegation based on accumulated routing intelligence, the inferred task type, and provider availability.
- **FR4**: Metis can execute the delegation against the selected provider and return the result inline within a single Claude Code session, with no persistent background processes.
- **FR5**: Metis can fall back through a hardcoded provider chain when the primary provider fails, recording each attempt as a distinct delegation record.

### Plan Confirmation & Review

- **FR6**: Developer can opt into a plan confirmation gate via configuration, choosing among `off`, `risky-only`, and `always`.
- **FR7**: Metis can generate a plan via a provider-adapter contract before executing any code-modifying action when the gate is active.
- **FR7a**: Metis can surface a visible plan-generation state when synthesis exceeds a perceptible threshold, and a structured failure state when synthesis fails.
- **FR8**: Metis can annotate the plan against a unified pattern registry (shared with the credential blocklist), surfacing typed risk findings — each finding carrying a type, severity tier, and source reference. FR8 is **pure-heuristic and deterministic in v1 — it is NOT LLM-as-judge**. Plan annotation does not invoke a model to reason about the plan; it pattern-matches. Adversarial LLM review is a separate, narrowly-scoped capability (FR-CRITIC-1, credential/secret exposure only) and stale-entity validation is owned solely by the Stale Entity Validator — neither is part of FR8.
- **FR9**: Metis can validate every entity reference in the plan against the current code state at plan-generation time and again at render, surfacing stale references as annotation findings.
- **FR10**: Plan card exposes accept, reject, edit, and detail-view affordances reachable via single-key keyboard input.
- **FR11**: Developer can abort the plan flow at any state. The delegation is recorded with terminal `failure_class: aborted` / `signal_class: aborted` (statistically silent — excluded from the Q-update, no reward/penalty contribution), NOT erased — the record is required for orphan reconciliation (FR32d) and for `/metis:why` to explain it.
- **FR12**: Metis can reroute to the next-best provider on plan rejection, capped at two reroutes per task, with a defined dead-end state when the cap is reached.
- **FR12a**: On plan rejection, developer can optionally provide a one-line reason that is captured as routing signal without blocking the reroute.
- **FR13**: Metis can surface a one-line receipt confirming plan review occurred when the gate is active, OR (when off/clean) a receipt indicating current gate mode and how to change it.

### Routing Intelligence

- **FR14**: Metis can maintain a probabilistic routing model over `(task_type, provider)` pairs scoped per repository, learning from outcome signals.
- **FR15**: Metis can record three tiers of reward signal — T1 (task completion), T2 (PR inclusion), T3 (commit retention) — for each delegation.
- **FR15a**: Reward tiers resolve on distinct timelines: T1 synchronously at task completion; T2 within a bounded window (default 7 days, configurable) with `null` resolution after expiry; T3 asynchronously when `reflect()` runs over post-task git history. The routing store MUST support deferred and out-of-order Q-updates.
- **FR16**: Metis can classify every delegation outcome with both a `failure_class` (14-value enum) and a `signal_class` (`fault` / `preference` / `correction` / `aborted` / `ambiguity`).
- **FR17**: Metis can update the routing model's Q-values only on `fault`-class signals; `preference`-class signals (e.g., `plan_rejected`) route to a separate replan policy and increment a per-arm diagnostic counter without contaminating the bandit.
- **FR17a**: Metis can capture `correction`-class signals (e.g., `plan_modified`) — when a user edits a plan before accepting, the diff between the proposed plan and the accepted-after-edit plan is persisted as plan-quality training data for v1.1 plan-quality regression. Does NOT decrement Q; increments a per-arm `modified_count` for diagnostic surfacing.
- **FR18**: Metis can surface routing rationale per invocation with an uncertainty label drawn from a defined set (e.g., `low` / `medium` / `high`) keyed to observation count and confidence tier.
- **FR19**: Metis can gate routing trust at a defined confidence threshold; when below threshold, Metis falls back to a global arm and surfaces the gating decision to the user.
- **FR20**: Metis can enforce that any delegation classified as a review/audit/critique task type routes to a provider different from the most recent implementer in the touched files (within the last 7 days of git history).
- **FR20a**: At delegation time, Metis MUST be able to identify the most recent implementer of the artifacts under review by reading the git history or invocations record. This capability is load-bearing for FR20.

### Compounding Memory

- **FR21**: Metis can maintain four memory networks per repository: `agent_experiences`, `world_facts`, `entity_summaries`, `evolving_beliefs`.
- **FR22**: Metis can populate `world_facts` via deterministic extraction (dependencies, languages, framework markers, package metadata) during the startup `reflect()` lifecycle.
- **FR22a**: Metis can execute `reflect()` at session start with cursor advancement to the latest processed event, idempotent on replay, writing T3 entries derived from post-task git history. The lifecycle MUST be observable via a structured log entry per invocation.
- **FR23**: Metis can populate `entity_summaries` lazily when a delegation touches an entity, with file-change-based invalidation triggering re-extraction.
- **FR24**: Metis can update `evolving_beliefs` incrementally from agent experiences with belief-strength scoring and invalidation, governed by §TS-1.13.
- **FR25**: Metis can inject relevant entries from all four memory networks into the delegation context, allocated under a token budget defined by configuration (`METIS_CTX_BUDGET`, default specified in §TS-1.14) with named priority order.
- **FR25a**: Before plan generation and routing arm selection, Metis MUST query the memory system for relevant context across all four networks. Routing features MAY include memory-derived signals.
- **FR26**: Metis can detect git reversions of delegation-produced commits and attribute T3 signals back to the originating delegation.
- **FR27**: Memory writes can fail independently per network without blocking other networks or aborting the delegation.

### Introspection & Recovery

- **FR28**: Developer can request post-hoc explanation of the last routing decision, with output sharing layout vocabulary with the plan card and a header anchored to the originating delegation timestamp.
- **FR29**: `/metis:why` MUST cite at least one historical outcome from the current repo's memory when that outcome influenced the routing decision (per AC-7).
- **FR30**: Developer can request a cold-return state readout that surfaces current configuration mode, recent decisions with accept/reject status, running accept-rate, and a memory-legibility summary that names which of the four networks influenced recent decisions and to what degree.
- **FR31**: Developer can issue a single destructive command (`/metis:forget`) that prompts between two scopes — `all` (wipe all bandit state and memory networks for the current repo) and `old` (trim records older than N days, default 90, optional per-network granularity) — with confirmation that displays exactly what will be destroyed before destruction proceeds. This replaces the former separate reset/prune capabilities and collapses the reset-vs-prune confusion into one concept with two safe branches.
- **FR32**: Developer can request inline help that fits within a bounded character count and describes the command surface and configuration discovery path.
- **FR32a**: On the first successful command after install, Metis can surface a one-time introduction naming what it just did and where to learn more. The introduction is suppressible and never re-surfaces on subsequent sessions.
- **FR32b**: Developer can abort a running `/metis:do` via Ctrl+C in the running session. Abort triggers in-process graceful cancellation: in-flight provider calls are cancelled, the partial memory write is finalized or rolled back transactionally (never left corrupt), and the delegation is recorded with a terminal classification that depends on provider responsiveness at abort time: a **responsive** delegation aborts to `failure_class: aborted` / `signal_class: aborted` (statistically silent — excluded from the Q-update, zero learning contribution, but persisted, never erased); a delegation already **hung past the unresponsiveness threshold** (§TS-1.16) aborts to `provider_timeout` / `signal_class: fault` (standard Q-decrement) so a Ctrl+C on a hanging provider does not erase the fault signal the bandit must learn from. A breadcrumb is printed (e.g., *"Delegation aborted. `/metis:why` to see what it attempted, or `/metis:do` to retry."*). A narrow cross-session `/metis:abort` MAY exist solely as a second-terminal escape hatch; it is not the primary path.
- **FR32d**: On `/metis:do` startup, Metis runs a deterministic ordered recovery sequence: **(1) stale-lock heal** (NFR-R1 — detect and clear a PID lock held by a dead process), **(2) orphan reconciliation** (detect an in-flight delegation record whose lease/heartbeat has expired and reconcile it to the `aborted` terminal without corrupting bandit or memory state), **(3) `reflect()`** (T3 detection + memory population). The ordering is contractual: reconciliation MUST complete before `reflect()`'s T3 pass so T3 never computes a reward over a record that abort is about to nullify. This is the recovery half of FR32b and is load-bearing for NFR-R2/R3/R5.
- **FR32e**: The `/metis:do` pipeline is built for cancellation: every state mutation is transactional or idempotent-replayable, every external provider call (`generate_plan` AND `execute`) is cancellable, and the reward signal has a recorded-but-statistically-silent `aborted` terminal. Cancellation safety is a property of the entire delegation pipeline, not a feature added by a separate command (contract in §TS-1.16).

### Security & Credential Protection

- **FR33**: Metis can scan task descriptions against a two-layer pattern registry before any provider call; matches halt the delegation flow with an explanatory message and zero provider invocations.
- **FR34**: Metis can scan injected context against the same pattern registry before forwarding to any provider; matches redact the field and emit a structured event without including the secret value or any substring that confirms its prefix.
- **FR35**: Metis can detect when no providers have valid credentials at startup and exit with setup guidance scoped to the detected environment, leading with the most likely available provider.
- **FR36**: Metis can validate provider credentials at delegation time and surface expired-credential errors with remediation steps, never mid-flight without surfacing.
- **FR-CRITIC-1**: Before any plan is forwarded for execution, Metis can run a Critic sub-agent that performs independent adversarial review **scoped to credential and secret exposure only** — it inspects the plan and its injected context for credential substrings, secrets written to non-secret sinks, exfiltration paths, and credential reuse across provider boundaries. The Critic returns a structured verdict (`{ passed: bool, confidence: int, findings: string[] }`); a confidence below the ≥80-point gate halts the delegation. The Critic does NOT judge plan quality, scope, or general "destructiveness" — those are out of its remit (plan-quality annotation is FR8's heuristic concern; stale-entity validation is owned solely by the Stale Entity Validator, Developer Tool Requirements §Stale Entity Validation). This is the Layer 2 enforcement mechanism referenced by FR34 and NFR-S1; full contract in §TS-SECURITY-1.

### Distribution & Configuration

- **FR37**: Developer can install Metis from the Claude Code marketplace via a single command, or via clone + post-install script as a development/fallback path.
- **FR38**: Developer can configure Metis behavior via optional configuration files at two scopes (per-repo and per-user-global), with sane defaults applying when no file is authored.
- **FR39**: Developer can override any configuration value per-invocation via command-line flag.
- **FR40**: Metis can migrate its persistent state schema atomically on startup when a version delta is detected, with backup-before-migrate and rollback on failure.
- **FR41**: Metis can enforce single-instance execution per machine via a lock file that auto-heals stale entries on startup.

### Observability & Telemetry

- **FR42**: Metis can record a structured debug entry for every routing decision, capturing routing-model state at decision time with hashed context references and zero payload content.
- **FR42a**: Metis can persist a queryable record of every delegation invocation — capturing task, provider, arm, plan outcome, signal_class, latencies per phase, and memory networks consulted — in a structured invocations store. This store is the system of record for `/metis:why` and `/metis:status`, distinct from FR42's debug NDJSON.
- **FR43**: Metis can surface a re-engagement prompt when the user has disabled plan confirmation AND T3 reversion rate (or rollback rate) crosses a defined threshold. The prompt is dismissible, rate-limited, and acknowledges the user's prior choice in its wording.

### FR → AC Coverage Matrix

| AC | Maps to FRs |
|---|---|
| AC-1 (Safety) | FR33, FR34, FR-CRITIC-1 |
| AC-CRITIC-1 (Critic adversarial credential review) | FR-CRITIC-1 |
| AC-2 (Learning) | FR14, FR15, FR15a, FR21, FR24, FR26 |
| AC-3 (Autonomous) | FR1, FR4 |
| AC-4 (Visible Learning) | FR18, FR28 |
| AC-5 (Memory Legibility) | FR30 |
| AC-6 (Taxonomy coverage) | FR16, FR17 |
| AC-7 (Per-repo citation) | FR29 |
| AC-8 (Reviewer ≠ Implementer) | FR20, FR20a |
| AC-9 (First-run) | FR1, FR32a, FR37, FR38 |
| AC-10 (signal_class routing) | FR16, FR17, FR17a |

## Non-Functional Requirements

*Quality attributes. Phase tags: **[v1]** = ship-gate for marketplace launch; **[v1.1]** = informed by dogfood telemetry; **[v2 aspiration]** = long-term target. Each NFR cross-references the AC or §TS-1 stub that validates or implements it.*

### Performance

- **NFR-P1 (Plan Generation Latency) [v1]:** Plan generation completes in ≤20s p95 for cloud providers (Claude Agent tool, Codex, Copilot CLI); ≤30s p95 for Ollama. Visible elapsed counter renders starting at 5s. Hard timeout: 45s cloud / 60s Ollama → fail-closed in `always` mode, fail-open with arm reliability down-weight in `risky-only` mode. **Baseline-pending** — Sprint 2 will instrument and capture ≥100 real plan-gen samples per provider; numbers may relax based on measurement.
- **NFR-P2 (First-Run Time-to-Value) [v1]:** First successful `/metis:do` after marketplace install completes in ≤60s (cross-references AC-9). Excludes one-time provider authentication setup.
- **NFR-P3 (Startup Time) [v1]:** `reflect()` lifecycle at session start completes in ≤2s p95 for repos ≤1000 commits, with the assumption that all extractors are deterministic (no LLM calls during reflect). Larger repos: `reflect()` runs in background; user can invoke `/metis:do` before completion (graceful degradation — memory networks return last-known-good state).
- **NFR-P4 (Context Injection Budget) [v1]:** Token budget target: **≤1,900 tokens** of injected memory context (grounded at 240 observations; achievable via memory-layer compression — the compression mechanism is an architecture decision, not specified here). Alert threshold: 2,200 tokens (surfaces warning in `/metis:status`). Hard cap: 4,000 tokens regardless of priority. Budget configurable via `METIS_CTX_BUDGET` env var. Priority order across the four memory networks is configurable (§TS-1.14).
- **NFR-P5 (Routing Decision Latency) [v1]:** Provider selection (sampling + memory consultation + signal classification) completes in ≤50ms p99. Memory consultation at routing time is metadata-only (no semantic search). Excludes plan-generation and execution latencies.
- **NFR-P6 (Schema Migration) [v1]:** Atomic migration completes in ≤5s for state DBs ≤100MB. Backup restore on failure completes in ≤2s.

### Cost Discipline

- **NFR-Cost1 (Cost Predictability) [v1]:** Metis MUST surface the cost-class of the selected provider before paid invocation. The plan card displays a provider cost-class indicator (`[free]` / `[metered]` / `[paid]`) in the header, following the NFR-M4 visual grammar. When a paid provider is selected and a credentialed local provider was available for the inferred task type, a continuation line (`↳ local unavailable: <reason>`) renders below the header. Acceptance: in a test setup with Ollama and Claude both credentialed, a delegation that routes to Claude renders a visible cost-class label AND a one-line rationale citing why local was not selected.

### Security

- **NFR-S1 (Credential Protection) [v1]:** Zero secret values appear in any of four protected surfaces (SQLite records, subagent prompts, log output, NDJSON debug log) across 100 test invocations against all four providers (cross-references AC-1). Pattern registry updated at package publish via CI lint step against GitHub secret scanning patterns. **Layer 2 enforcement mechanism:** a `PreToolUse` hook intercepts every outbound context payload before it reaches a provider API; the Critic sub-agent (§TS-SECURITY-1) performs adversarial credential verification at this hook point with a ≥80pt confidence gate. The static pattern scan (Layer 1) catches known formats; the Critic side-query catches novel or obfuscated patterns that the static scan misses.
- **NFR-S2 (signal_class Taxonomy Integrity) [v1]:** `preference`-class and `correction`-class signals MUST NOT decrement Q-values; `fault`-class signals decrement per §TS-1.4 (cross-references AC-10). Prevents training-data poisoning where user veto/edit signals contaminate fault-trained bandit.
- **NFR-S3 (Threat Model Scope) [v1 charter]:** Metis defends against accidental exfiltration of developer credentials via user-typed task descriptions or stale injected context. Metis does NOT defend against compromised provider endpoints, malicious repo files, or system-level attacks. Out-of-scope threats are documented and not enforced. *(Scope statement, not measurable.)*
- **NFR-S4 (Fail-Closed Default) [v1]:** When capability state is unknown or detection fails, Metis assumes capability is absent and disables the dependent feature. Tested at gates G1 (missing API key → no plan), G2 (lock contention → exit non-zero), G3 (schema mismatch → refuse run), G4 (plan annotation failure → halt rather than proceed unannotated). Never silently degrades to a less-safe fallback.

### Reliability

- **NFR-R1 (Single-Instance Enforcement) [v1]:** One Metis instance per machine at a time via PID lock at `~/.metis/metis.lock`. Stale locks from crashes auto-healed at startup. Concurrent startup races handled via exclusive file create (§TS-1.5).
- **NFR-R2 (Atomic Schema Migration) [v1]:** All pending migrations commit as a single transaction or not at all. Database backed up before any migration attempt; restored atomically on failure via `fs.renameSync`. `schema_version` updated only after full batch commits. Downgrade detected at startup → clear error with installed version, required version, remediation command (§TS-1.6).
- **NFR-R3 (Per-Network Memory Failure Isolation) [v1]:** One memory network's write failure MUST NOT block another's write or abort the delegation — graceful degradation defined as: failure logged as structured NDJSON event with `network` and `error_class` fields; delegation proceeds with available networks; routing-decision-time memory consultation imposes per-network 20ms timeout (timeout = skip, not failure).
- **NFR-R4 (Provider Failure Cascade) [v1]:** Single provider failure does NOT equal delegation failure — fallback chain progresses on failure. Ordered chain: Claude → Codex → Copilot CLI → Ollama. Inter-step latency budget: secondary provider invoked within ≤500ms of primary failure detection. Full chain exhaustion → user-visible explanation, no silent retries (Journey 6 contract).
- **NFR-R5 (SIGKILL Recovery) [v1]:** SQLite WAL mode (`PRAGMA journal_mode=WAL`) + stale-lock detection on startup constitutes the recovery path. No data loss on SIGKILL of Metis process. Schema state always recoverable to last committed migration.
- **NFR-R6 (Cross-Session Memory Persistence) [v1]:** Metis state — bandit posteriors, all four memory networks, dismissal history, invocations log — MUST persist across Claude Code sessions on the same repo without manual intervention. Acceptance: shut down Claude Code, restart in the same repo, run `/metis:status` — decisions from the prior session are still visible AND `/metis:why` citations from prior sessions still appear when memory influenced routing. Without this NFR firing, the "compounding memory" thesis collapses on session boundaries.
- **NFR-R7 (Concurrency & Abort Model) [v1]:** Concurrent `/metis:do` invocations against the same repo on the same machine MUST be serialized. Abort of a running `/metis:do` is **in-process Ctrl+C**, not a cross-session command: Ctrl+C triggers graceful cancellation (cancel in-flight provider calls, transactionally finalize or roll back the partial memory write, record the recorded-but-statistically-silent `aborted` terminal). A process that dies before cleanup leaves an in-flight record reconciled deterministically on the next startup via the ordered recovery sequence stale-lock heal → orphan reconciliation → `reflect()` (FR32d). A second concurrent invocation waits up to 30s with a visible elapsed counter, then errors with an explicit actionable message naming the running PID and start time and pointing to Ctrl+C in the owning session; if that invocation finds the lock holder is dead, its own startup runs the FR32d recovery sequence (heals the stale lock, reconciles the orphan) before proceeding. **Accepted limitation:** if a session is genuinely wedged (provider socket open, no response) and unresponsive to Ctrl+C, the per-provider 300s delegation timeout (Open Spec Items) is the named backstop — there is no faster manual recovery in v1; the cross-session `/metis:abort` kill is deferred to v1.1. Never run in parallel against the same `~/.metis/` state. v1 is single-writer per repo per machine; multi-writer support is v2-candidate. Contract in §TS-1.16.
- **NFR-R8 (Disk Footprint) [v1]:** Total `~/.metis/` footprint targets ≤500MB at one year of typical daily solo-developer use. NDJSON debug log enforces 30-day/10MB per-file retention (NFR-Pr2). If `~/.metis/` total approaches 400MB, Metis surfaces a one-time warning via `/metis:status` with an actionable suggestion (`→ run /metis:forget old` to trim records older than 90 days). Automatic trimming under this cap plus the manual `/metis:forget old` path together serve the job — there is no standalone `prune` command. Hard cap or compaction strategy is v1.1.
- **NFR-R9 (Memory Working Set) [v1]:** Peak RSS ≤200MB during steady-state `/metis:do` operation. Peak RSS ≤500MB during `reflect()` lifecycle on repos ≤1000 commits. Larger repos: `reflect()` processes commits in bounded chunks to stay within the 500MB cap. The blended context allocator (§TS-1.14) MUST operate within the steady-state bound.

### Privacy

- **NFR-Pr1 (Debug Log Content) [v1]:** NDJSON debug log records bandit state, hashed context references (SHA-256), and zero payload content. `pattern_id` field stores rule label only (e.g., `rule:anthropic_key`), never any substring of the secret value (prevents prefix-confirming oracle).
- **NFR-Pr2 (Retention Policy) [v1]:** Debug log files at `~/.metis/debug/YYYY-MM-DD.jsonl` enforce 30-day OR 10MB per-file retention (whichever triggers first). Older files auto-rotated/deleted on startup. Invocations table retention: indefinite in v1; trim policy specified in v1.1.
- **NFR-Pr3 (Local-Only Data) [v1]:** All Metis state (SQLite, JSONC config, NDJSON log) is local-only. No outbound network calls except to provider APIs at delegation time.

### Integration

- **NFR-I1 (Provider Adapter Contract) [v1]:** Each provider adapter implements `generate_plan(task, signal: AbortSignal) → Promise<Plan>` and `execute(task, approved_plan, signal: AbortSignal) → Promise<Result>`. **Both phases take an `AbortSignal`** — the execute phase is the longer, riskier one and MUST be cancellable for the §TS-1.16 abort contract to hold. Native planners (Claude, Codex) use direct planning API calls; CLI/HTTP providers (Copilot CLI, Ollama) emulate via structured-output prompts and MUST honor cancellation (kill the child process / abort the HTTP request on signal). Plan schema in §TS-1.10.
- **NFR-I2 (Host Integration) [v1]:** Claude Code is the runtime host. Plugin layout conforms to Claude Code marketplace manifest (§TS-1.9). Provider/routing logic decoupled from command layer (Domain Requirements §Runtime Contracts).
- **NFR-I3 (Git Integration) [v1]:** Git history readable at runtime for T3 reversion detection (FR26) and reviewer-implementer enforcement (FR20a). Repo root detection via `git rev-parse --show-toplevel`. Standard git commands only; no plumbing-level access required.
- **NFR-I4 (Marketplace Integration) [v1]:** Marketplace install via `claude plugin install metis`. `plugin.json` declares `post_install` hook → `scripts/init.sh` (SQLite DDL, `~/.metis/` setup, prior seeding). Clone+install.sh fallback runs identical init script. Both paths converge on same state.

### Maintainability / Observability

- **NFR-M1 (Routing Rationale Visibility) [v1]:** Per-invocation rationale visible inline as terminal-width output (FR18). Post-hoc rationale via `/metis:why` (FR28). When memory influenced routing, `/metis:why` MUST cite at least one repo-specific historical outcome (FR29, AC-7).
- **NFR-M2 (Telemetry Records) [v1]:** `invocations` queryable table (FR42a) is the system of record for `/metis:why` and `/metis:status`. NDJSON debug log (FR42) is a separate debug surface. AC-5 Memory Legibility surface in `/metis:status` (FR30) makes the four-network memory observable to users. Invocations query MUST return within 100ms for ≤10k rows.
- **NFR-M3 (Diagnostic Counters) [v1]:** Per-arm `rejected_count` (preference signals) and `modified_count` (correction signals) capture user-action volume without contaminating Q-values. Bandit observation count per arm. T1/T2/T3 resolution timestamps captured in invocations table. **Additional telemetry (v1):** citation rate per delegation (fraction of memory-network lookups that influenced the routing decision), TTFT (time-to-first-token) and TPS (tokens-per-second) per provider arm captured at delegation time, confidence score distribution across routing decisions (p50/p90/p99 `t3_confidence` per arm). These metrics are queryable via the `invocations` table and surfaced in the `/metis:status` learning-progress dimension.
- **NFR-M4 (Calibration / Honesty) [v1 — thesis-aligned]:** When Metis's confidence in a routing decision falls below the routing-gate threshold, the rationale MUST surface the uncertainty explicitly. When plan annotation flags risk findings, the plan card MUST surface them prominently. When plan generation falls back from native plan mode to prompt-engineered mode, this MUST be visible in the plan card. Across 100 synthetic test invocations where uncertainty was injected, ≥95% must surface an uncertainty label or fallback rationale. **This NFR encodes the thesis claim that Metis is a learnable surface — users build trust by seeing the system admit when it doesn't know.**

  **NFR-M4 Visual Grammar (design principle):** The three admissions M4 enforces are NOT interchangeable. They must share visual vocabulary so users learn the grammar:
  - **Low confidence on routing** → *parenthetical inline*, quietest: `arm: incremental-refactor (low confidence · 3 obs)`. Reads as a footnote on the choice.
  - **Risk findings on plan annotation** → *section with bullets*, loudest about the work: existing "Risks Metis flagged" block. Bullet list, no truncation.
  - **Plan-gen fallback (native → prompt-engineered)** → *header badge*, loudest about the system: `provider: claude-sonnet [paid] · annotation: ok · plan: approximated`. Cannot be missed on a 5-second scan.

  The grammar is a contract: parenthetical = "noted," section = "read this," header badge = "the system itself is degraded." Future system-honesty features inherit one of these three volumes. **This is the explicit design principle, not just three coincidental UI choices.**

### Compatibility

- **NFR-C1 (Runtime Floor) [v1]:** Node.js ≥18.0.0 hard requirement. Startup version guard exits before any other logic with descriptive error if floor not met. CI matrix: Node 18 LTS + Node 20 LTS.
- **NFR-C2 (Module System) [v1 preference]:** TypeScript ES2022 target. CommonJS preferred for v1 module system (Claude Code plugin loader ESM behavior unverified); ESM accepted where unavoidable and cleanly testable. ESM-default migration is v2-candidate.
- **NFR-C3 (Platform) [v1]:** Cross-platform path handling — all data directory paths use `path.join(os.homedir(), '.metis')`, never string concatenation. `OLLAMA_HOST` env var honored for non-default Ollama endpoints. `METIS_DATA_DIR` env var override available for CI environments and containers.
- **NFR-C4 (Git Operation Coexistence) [v1]:** Metis state operations on `~/.metis/` MUST NOT block concurrent git operations in the user's repo. Specifically: `reflect()` reads git via short-lived commands (no long-running git processes held open across delegation lifecycles); Metis never holds a lock on the user's repo (`.git/`) — only on its own `~/.metis/metis.lock`. Acceptance: while `reflect()` is running on a 1000-commit fixture repo, `git status` in the same repo completes in ≤500ms p95 (the same envelope as without Metis running).

## Decision Log (Appendix)

*Key decisions and their rationale, captured to prevent re-litigation. When someone later asks "why was this done this way?", this is the record.*

| # | Decision | Rationale |
|---|---|---|
| 1 | **v1 / v1.1 / v2 phasing labels** | Concrete commitments (v1 = ship-gate, v1.1 = next iteration informed by dogfood, v2 = long-term) instead of ambiguous "MVP / Growth / Vision." |
| 2 | **Four-network memory in v1** | The Executive Summary thesis names "compounding memory" as half the differentiation. Deferring four-network memory would ship a thesis the implementation does not back. |
| 3 | **Evolving beliefs in v1 (not deferred to v1.1)** | All four networks ship together. The reputational risk of over-claiming "compounding memory" exceeds the scope risk of `evolving_beliefs`. |
| 4 | **Plan-confirmation reward design: accept=0, reject=penalty, edit=correction** | Conservative reward signal. Accept=0 prevents rubber-stamp from corrupting the bandit. Reject penalizes via `plan_rejected` (preference-class, no Q decrement, routes to replan). Edit captures the diff as plan-quality training data (correction-class). Preserves the 30/30/40 T1/T2/T3 weighting. |
| 5 | **`signal_class` split (fault / preference / correction / aborted / ambiguity)** | Prevents training-data poisoning. Without signal_class, user-veto, user-edit, and user-abort signals would contaminate the fault-trained bandit and break credit assignment. `aborted` is recorded-but-statistically-silent so abort never poisons the bandit yet the record survives for orphan reconciliation. |
| 6 | **JSONC for configuration (not TOML)** | The Claude Code ecosystem is JSON-everywhere (`settings.json`, MCP, plugin manifests). JSONC adds comments without leaving the ecosystem. Migration to an alternative format remains a v2-backlog item if dogfooding indicates need. |
| 7 | **Marketplace as canonical distribution + clone+install.sh as fallback** | Marketplace is the user-discoverable path; clone is the dev/contributor path. Shared `scripts/init.sh` ensures both paths converge on identical state. |
| 8 | **Plan annotation reuses the two-layer credential blocklist (unified pattern registry)** | Single source of truth for "what is risky." Plan annotation extends the registry via a scope tag rather than inventing a parallel scanner. |
| 9 | **VS Code / JetBrains explicitly out of scope (not v1, not v2)** | Metis is a Claude Code plugin. The decoupling NFR exists to support future *Claude Code surfaces*, not multi-IDE. Locked as an Executive Summary non-goal so the exclusion requires a PRD amendment to reverse. |
| 10 | **8-week timeline** | Total v1 ≈ 40 engineer-days (plan-confirmation ~17.5d, four-network memory ~16d, integration ~4d, wiring ~2-3d). The honest commitment, not an optimistic estimate. |
| 11 | **Hardcoded fallback chain (Claude → Codex → Copilot CLI → Ollama) for v1** | User-configurable order is v1.1. Bandit Q-values progressively override the static order as observations accumulate; the chain matters most at cold-start. Order rationale: Claude as assumed-strongest planner, Codex next, Copilot CLI third, Ollama as terminal local-only fallback. |
| 12 | **AC-10 (signal_class routing behavior) separate from AC-6 (taxonomy coverage)** | AC-6 validates the enum exists and maps cleanly; AC-10 validates the routing behavior under each class. Coverage vs. enforcement. |
| 13 | **`/metis:status` minimal in v1, full tinkerer dashboard in v1.1** | The worker glance (mode + recent decisions + memory-legibility line) serves the cold-return job in v1. Bandit Q-values and posterior dumps are deferred as tinkerer surfaces. |
| 14 | **Off-ramp suggestion prompt deferred to v1.1 (footer hint stays v1)** | The 20-clean-accepts threshold is a guess without telemetry. v1 ships an always-on footer hint for discoverability; v1.1 adds the smart threshold prompt once telemetry validates it. |
| 15 | **On-ramp banner ships v1 (despite threshold being a guess)** | Asymmetric stakes: omitting it is catastrophic and silent (user loses code and trust); including it with a wrong threshold is a dismissible banner. Safety rails ship early. |
| 16 | **Mid-sprint signal-volume sanity check at week 4** | The fragile assumption underlying v1 is interpretable learning-signal volume within 8 weeks of solo dogfooding. The week-4 gate prevents the learning loop from becoming unfalsifiable theater. |
| 17 | **NFR-M4 visual grammar (parenthetical / section / header badge) as design principle** | Three different admissions need three different volumes. Locked as a contract so future system-honesty features inherit a defined visual vocabulary. |
| 18 | **Command surface reconsidered from first principles → 5 commands + Ctrl+C** | The set had grown to 7-8 through accretion ("an NFR needs a user action" is not sufficient justification for a command). Genuine user verbs: `do`, `why`, `status`, `help`, `forget`. Everything else was a non-command in a command costume. |
| 19 | **`reset` + `prune` collapsed into `/metis:forget` (`all` / `old`)** | Both were destructive maintenance the user does ~once; under stress they collapse into one intent ("clear the memory that's messing me up") and the user could grab the wrong one. One word, two safe branches behind a deliberate second choice + preview, eliminates the footgun. |
| 20 | **`/metis:abort` is not a command — abort is Ctrl+C + startup reconciliation** | Abort is needed exactly when `/metis:do` owns the input line, so a slash command is un-typable in the moment it exists for. As a cross-session command it would also force an externally-triggered interruption into `do`'s critical section, threatening the atomic-write guarantees of NFR-R2/R3/R5. The sound design is in-process Ctrl+C plus deterministic reconciliation of orphaned records — a property of the whole `do` pipeline (§TS-1.16). |
| 21 | **Manual T3 correction (`/metis:why --bad`) deferred to v1.1; v1 attribution is conservative** | A wrong T3 penalty poisons the bandit worse than a missing one, so v1 attributes nothing rather than wrong on rewritten history. Manual correction is not cheap — it's a reward-pipeline consistency change (retraction/deferred-finalization, AC-2 re-check, observed-vs-asserted signal_class), so it ships in v1.1 surfaced inside the `/metis:why` output. |
| 22 | **FR-CRITIC-1 scoped to credential/secret exposure only; FR8 stays pure-heuristic; AC-CRITIC-1 fixed at 25/25 for v1; Critic harness effort deferred to §TS-SECURITY-1 authoring** | Resolved across a six-agent roundtable on the post-NLM validation Warning. FR-CRITIC-1 is a standalone FR, not a clause folded into FR8/FR34 — an LLM adversarial judge has a different runtime shape (non-deterministic, token cost, model failure modes) than FR8's deterministic pattern scan; merging them creates an untestable two-AC FR. Scope is narrowed to credential/secret exposure ONLY because that is the only sub-problem with a constructible binary oracle — "plan quality" and "destructive command" have no stable ground truth, and stale-entity is already owned deterministically by the Stale Entity Validator (routing it through an LLM Critic would create a two-mechanism arbitration conflict). AC-CRITIC-1 stays 25/25 for v1 (not 50/50): the tighter false-positive resolution does not change the go/no-go call and a solo dev's days are zero-sum on an 8-week v1; 50/50 is a v1.1 tightening on the same harness. Critic harness cost is NOT estimated before §TS-SECURITY-1 exists — the "few days / reuse AC-1 harness" estimate was found to be unbacked (AC-1 is a presence-assertion harness; AC-CRITIC-1 needs a labeled-corpus classifier harness — different shape). **Opportunity-cost trade recorded for the solo founder:** the Critic consumes engineering days that could instead close the three unretrieved NLM research queries (M-5 circuit-breaker auto-disable, M-7 team-memory threshold, M-10 npm-install adoption); the Critic wins this trade only because it is the named enforcement mechanism for AC-1, a pre-existing hard release gate — but the trade is logged so it is made consciously, not by omission. |
