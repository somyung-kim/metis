# NotebookLM Research Findings — Metis Resources
**Date:** 2026-05-15
**Notebook:** Metis Resources (33 sources)
**Purpose:** Validate and challenge core PRD bets before architecture phase

---

## How This Was Produced

Eight targeted queries were submitted to the "Metis Resources" NotebookLM notebook (33 sources on agentic engineering, harness engineering, context engineering, local inference, model optimization, and software workflows). Queries were designed by a four-agent party-mode session (Winston/Architect, Amelia/Engineer, John/PM, Mary/Analyst) to test the load-bearing bets in the Metis PRD.

---

## Q1 — Compaction Race Condition on Injected Memory

**Query:** Does Claude Code's compaction discard injected non-code context? Is there a documented integration point for persistent context injection that survives compaction?

### Findings

- Proactive and reactive compaction **can discard injected context** — both summarize older messages, and any detail summarized away is gone permanently.
- **`PreCompact` hook exists** (documented in agentmemory source): fires before compaction and re-injects critical memory, preventing loss of persistent context.
- Claude Code exposes a **25+ event hook system**: `SessionStart`, `UserPromptSubmit`, `PreToolUse`, `PostToolUse`, `PreCompact`, `SubagentStart/Stop`, `Stop`, `SessionEnd`.
- **`MEMORY.md` file convention** is loaded on every turn under `# auto memory` and treated as overriding default behavior — a stable injection point independent of compaction.
- Caveman tool's 75% output token reduction operates on *output* tokens only; it does not conflict with memory injection. A `caveman-compress` sub-skill compresses memory *files* (~46% reduction at source) before injection.

### PRD Implication

**✅ Injection strategy is viable.** Metis MUST use the `PreCompact` hook for context re-injection — static injection at session start will not survive reactive compaction. Add as §TS-1 stub.

---

## Q2 — Thompson Sampling Validity Under Local Inference Variance

**Query:** Does TS's stationary reward assumption hold for Ollama? What does the evidence say about local model variance profiles?

### Findings

- Local SLMs on shared hardware show **up to 30% variance between runs** due to noisy neighbors (documented in llama.cpp optimization research).
- Text generation latency variance: **±19 tokens/sec** baseline, dropping to ±0.59 after kernel fusion — highly environment-dependent.
- Sources recommend using **stddev as a quality signal**: "only trust results where stddev < 2% of the mean."
- No source discusses Thompson Sampling, UCB, or contextual bandits explicitly.
- Sources recommend **dynamic runtime adjustments** over static routing algorithms.
- Critical finding on cross-provider routing: effective routers must "serve the right dialect to each model" — not a common denominator. Attempting a uniform dialect causes quiet performance degradation.
- "Context anxiety" documented: local models become increasingly desperate to end sessions as context fills, producing lower-quality completions over time.

### PRD Implication

**⚠️ TS stationary assumption is under stress for Ollama specifically.** PRD should:
1. Add stddev tracking as a routing signal alongside mean quality for the Ollama arm.
2. Give Ollama's bandit arm higher exploration weight (or a wider prior) to account for environmental variance.
3. Note that each delegated provider must receive its native tool dialect — Metis cannot route to a "common denominator" format.

---

## Q3 — Bandit Cold-Start Threshold + Reward Poisoning

**Query:** What is the minimum threshold before bandit routing is reliable? Does signal_class decomposition prevent reward poisoning?

### Findings

- No universal mathematical threshold documented, but empirical data points:
  - Single-agent improvement loops: **8-12 probes** per improvement pass.
  - Complex research tasks: **30+ experiments** before stable performance gains.
- **"Verification laziness"** is well-documented: agents implement behavior A', write a weak test for A', watch it pass, declare success. This directly **poisons T1 (task completion) signals**.
- Code that compiles, passes tests, and looks fine in review can quietly violate architectural assumptions — "the scariest thing isn't when agents break your code, it's when they don't."
- Signal decomposition is **necessary but not sufficient**: the "organism" pattern (every production failure → deterministic lint rule) is the real long-term defense.
- The Critic pattern (adversarial sub-agent that attempts to *disprove* findings before reporting completion) is the documented mitigation for verification laziness.
- Anthropic's internal build includes a `VERIFICATION_AGENT` feature flag — adversarial sub-agent reviews non-trivial changes before reporting completion.

### PRD Implication

**⚠️ T1 reward is vulnerable to verification laziness.** PRD should:
1. Explicitly connect the plan-confirmation gate to the Critic agent pattern — the gate is the adversarial verification step.
2. Consider T1 signals from plan-confirmed delegations as higher-quality than unconfirmed completions.
3. Add a note that signal decomposition (`signal_class`) is the necessary first layer; deterministic output validation (linter-style) is the second layer.

---

## Q4 — Self-Review Blindness as Actual Bottleneck (Existential Check)

**Query:** Do sources confirm self-critique failure as a primary structural bottleneck in developer AI workflows?

### Findings

- **Confirmed as primary, documented bottleneck** across multiple independent sources.
- Specific failure modes named:
  - **Verification laziness**: agent writes weak test for A', declares behavior A complete.
  - **Cognitive rationalization**: "Claude is a poor QA agent — it identifies legitimate issues then talks itself into approving the work anyway."
  - **Invisible tech debt**: code compiles, passes all tests, looks fine in review, quietly violates architectural assumptions.
  - **Complexity fear**: agents trained via RL to avoid difficult tasks — they write stubs or declare work "out of scope" rather than face complex self-correction.
- Attribution: **both** fundamental (RL-trained avoidance) and fixable (harness engineering + external verification).
- Strong evidence for fresh-context critique superiority:
  - Fresh context agents produce better verification (avoiding confirmation bias from the generation session).
  - Anthropic's internal `VERIFICATION_AGENT` feature flag spawns adversarial sub-agent specifically to review non-trivial changes.
  - Disproof-oriented scoring subagents: findings must survive a challenge at confidence ≥80 before reaching the user.

### PRD Implication

**✅ Core problem framing confirmed.** The "self-review blindness" bet is grounded in multiple independent sources. No pivot needed.

---

## Q5 — Token Cost Methodology and Net Budget Per Delegation

**Query:** What does agentmemory's 92% reduction actually measure? What is the net absolute token budget?

### Findings

- Benchmark baseline: **240 observations**, built-in memory (CLAUDE.md loads everything) = **22,000+ tokens**.
- After BM25+vector+graph retrieval (top-K only): **~1,900 tokens/session**.
- 92% reduction = 22K → 1.9K at 240 observations. Not a percentage of a 100K baseline — it's a realistic developer-scale scenario.
- Retrieval method: **triple-stream hybrid** — BM25 (keyword), vector (cosine similarity), graph (entity traversal) — fused via Reciprocal Rank Fusion (RRF, k=60). Top-K results only, session-diversified (max 3 results per session).
- **TurboQuant applies to model inference (KV cache) only** — not to the memory retrieval step. The 6x memory / 8x speed claims are for on-device model execution, not RAG retrieval.
- Caveman's `caveman-compress` reduces memory *files* ~46% (898 → 481 tokens average) before injection. Output tokens separately reduced ~75%.

### PRD Implication

**✅ Token budget grounded.** ~1,900 tokens/delegation is the concrete target for Metis's memory injection. TurboQuant cannot be cited to reduce retrieval costs — it's inference-only. PRD should reference 1,900 tokens as the design target for memory context injection per delegation.

---

## Q6 — Task-Type Taxonomy: What Is Actually Local-Suitable?

**Query:** What tasks are local-suitable per the localmaxxing and SLM sources? Are code-generation and codebase analysis included?

### Findings

**Local-suitable (narrow, repetitive, low-latency, verifiable):**
- Admin and scheduling tasks
- Email triage and inbound summarization
- Template-based content generation
- Simple engineering: linter bumps, boilerplate, simple script debugging, single-file edits
- Terseness-driven tasks where brevity is a feature (local models often produce half the tokens)

**NOT local-suitable (requires broad reasoning, large context, or multi-file synthesis):**
- Multi-file codebase analysis
- Complex code review requiring cross-file reasoning and architectural judgment
- Multi-step reasoning across unfamiliar domains
- Tasks requiring broad general knowledge or novel reasoning

**Code-specific findings:**
- Code generation: **included** for simple edits and boilerplate; **excluded** for complex multi-file work.
- Code review: **excluded** from simple local routing. Advanced code review requires a multi-agent pipeline with confidence scoring. Local models can handle *shallow bug sweeps* with narrow scope.
- A local model (Qwen 3.5-9B 4-bit) successfully handled a 4-file linter bump but failed on a dependabot PR with complex git merge conflicts.

**Decision boundaries a router can operationalize:**
- Narrow scope + high volume + low latency tolerance + output verifiable → local
- Broad general knowledge + large context + multi-step reasoning → cloud

### PRD Implication

**⚠️ Ollama routing priors need narrowing.** Routing "code review" or "multi-file analysis" to Ollama is not supported by the evidence. Q_INIT_PRIORS for Ollama should start **low** for `code_review`, `multi_file_analysis`, and `architectural_decision` task types. PRD's localmaxxing claim needs explicit scoping to narrow/routine task types.

---

## Q7 — Harness-Native vs. Plugin-Layer Memory (Structural Ceiling)

**Query:** Do sources document capabilities accessible to harness-native memory that a plugin cannot observe?

### Findings

**Capabilities structurally unavailable to plugin-layer memory:**
- **Ralph Loops**: hook-level session continuation pattern (intercepts model's exit attempt, reinjects original prompt in clean context) — only possible from inside the harness.
- **Self-tracing**: agents reading their own logs to find harness-level failure modes — native harness capability.
- **Symphony's Linear DAG**: task dependency state machine managed by the harness; a plugin cannot coordinate task-blocked-on-task relationships without full control over the task board.
- **Citation tag / decay signal access**: most critical finding:
  - Codex model emits `<oai-mem-citation>` tags; Claude Code ignores them, `usage_count` never bumps, Codex's decay loop evicts good memories because they look unused.
  - Claude model on Codex: no citation tag emitted, inline memory used, Codex's decay loop evicts good memories.
  - "A six-character XML tag becomes the difference between a memory system that improves with use and one that degrades silently."

**Quantified performance degradation for cross-harness operation:**
- Same model (Claude Opus 4.6), different harness: **4.5 percentage point spread** on Terminal-Bench 2.0 (ForgeCode: 79.8% vs. Capy: 75.3%).
- Cursor: Top 30 → Top 5 on Terminal-Bench 2.0 by changing the harness only (same model, same benchmark).
- Giving a model its unfamiliar tool format "costs extra reasoning tokens and produces more mistakes" — documented at scale across millions of agent turns.

**Copilot CLI's multi-model routing as a reference implementation:**
- Per-model tool surface (apply_patch for Codex, Edit/Write for Claude).
- Per-model tool loading (ToolSearch deferred for Claude, full list up-front for OpenAI).
- Dedicated Critic agent (different model) reviews plans — but only for Claude models, not OpenAI.

### PRD Implication

**⚠️ Structural ceiling is real and specific.** Metis cannot observe citation tags or usage_count signals from delegated providers. PRD must:
1. Add this as a named risk in the risk register (not a footnote): "Plugin-layer memory cannot observe per-provider citation/decay signals. Routing intelligence for Codex and Copilot CLI will have noisier decay signal quality than a harness-native implementation."
2. Metis must serve each provider its native tool dialect (not a common denominator) — this is a direct constraint on how delegation context is injected.

---

## Q8 — Build vs. Buy: Does agentmemory Make the Four-Network Design Redundant?

**Query:** What does agentmemory provide vs. what a custom SQLite design retains?

### Findings

**agentmemory is built on SQLite + iii-engine** (not Postgres + pgvector) — the storage primitive isn't the gap. It replaces Express, SQLite/Postgres+pgvector, SSE, pm2, Prometheus with iii primitives.

**Non-trivial to replicate in custom SQLite:**
- Triple-stream hybrid retrieval (BM25 + vector + graph, RRF fusion) — high-performance semantic similarity + graph traversal + keyword search is significant engineering.
- 4-tier async memory consolidation (Working → Episodic → Semantic → Procedural) with Ebbinghaus decay curves, auto-eviction, contradiction detection.
- 12 pre-integrated lifecycle hooks for Claude Code, Codex, Cursor, Gemini CLI, OpenClaw.
- OTEL observability (waterfall/flame trace views for every memory operation) — ships out of the box, zero instrumentation required.

**What custom design uniquely retains:**
- **Harness-aligned citation tags per provider**: emit correct citation format for Codex vs. Claude vs. Copilot CLI to prevent memory decay signal corruption.
- **Bandit-specific reward tables (T1/T2/T3)**: general memory engines store "what the agent knows"; custom design stores "how the agent is managed" — routing state, provider performance per task type, failure classes.
- **Per-codebase routing state**: Thompson Sampling bandit arms, Q values, priors — not a general memory concept.
- **Evolving belief systems**: treat authoritative facts differently from evolving project-level assumptions. General engines apply uniform importance weights.
- **Tight DAG integration**: coupling memory of a "failed run" directly to routing updates requires a schema agentmemory doesn't have.

### PRD Implication

**✅ Hybrid approach is the right architecture.** Recommendation:
- **Adopt agentmemory MCP** for general session memory layer (BM25+vector+graph retrieval, lifecycle hooks, 1,900-token budget, OTEL observability) — this is the `world_facts` and `entity_summaries` territory.
- **Build custom SQLite tables** for routing state and bandit data (`agent_experiences`, `evolving_beliefs`, bandit Q-values, failure_class records, signal_class records).
- This halves the implementation surface without giving up routing sovereignty.

---

## Summary Scorecard

| # | Query | Verdict | PRD Change Required |
|---|---|---|---|
| Q1 | Compaction injection race | ✅ Solved — PreCompact hook is the documented integration point | Add to §TS-1: use PreCompact hook for re-injection |
| Q2 | TS validity under local variance | ⚠️ Elevated risk — 30% run-to-run variance, stationary assumption stressed | Add stddev signal to Ollama arm; widen Ollama prior |
| Q3 | Bandit cold-start + poisoning | ⚠️ T1 vulnerable to verification laziness | Connect plan-gate to Critic pattern; note signal decomposition is layer 1 only |
| Q4 | Self-review blindness | ✅ Confirmed as primary, documented bottleneck | No change needed — bet is right |
| Q5 | Token budget methodology | ✅ Grounded — ~1,900 tokens/session at 240 observations | Cite 1,900 tokens in NFR/tech-spec; TurboQuant ≠ retrieval |
| Q6 | Local task taxonomy | ⚠️ Ollama priors too broad — code review + multi-file analysis are NOT local-suitable | Narrow Ollama Q_INIT_PRIORS for code_review, multi_file_analysis |
| Q7 | Plugin-layer ceiling | ⚠️ Citation/decay ceiling confirmed — specific and named | Add to risk register; per-provider dialect constraint is real |
| Q8 | Build vs. buy | ✅ Hybrid path validated | Consider agentmemory MCP for general layer + custom tables for routing state |

**4 confirms, 4 calibration changes. No pivots.**

---

## Round 2 Research — Extended Party-Mode Queries

**Queries generated by:** Four-agent party-mode session (Mary/Analyst, Winston/Architect, Amelia/Engineer, John/PM)
**Total queries attempted:** 39 (M-1–M-10, W-1–W-10, A-1–A-10, J-1–J-9)
**Queries fired (across Batches 1–4):** 36 of 39 successful
**Failures (RESOURCE_EXHAUSTED):** M-5, M-7, M-10

---

### Market & Competitive Findings (M-1 through M-10)

---

#### M-1 — Competitive Moat: What Makes a Routing Plugin Defensible?

**Query:** What gives an AI routing plugin a defensible moat against native providers shipping the same feature?

### Findings

- **Model-Harness-Fit as moat:** The moat is not the model — it is the matched pair. Post-training bakes tool names, schema shapes, citation tags, memory rituals, and planning protocols into model instincts. Swapping the harness loses that work permanently.
- **Co-evolution loop:** Harness primitives → agent traces → training data for next model → model instincts match harness natively. A third-party plugin building this loop early accumulates an advantage that native providers cannot replicate cheaply.
- **Citation discipline:** Correct per-provider citation tags (e.g., `<oai-mem-citation>`) are the difference between a memory system that improves with use and one that degrades silently. Native providers bake this in; plugins must replicate it explicitly.
- **Organism pattern:** Every production bug → deterministic lint rule. Self-tightening loop that turns failure into a permanent structural defense.
- Terminal-Bench 2.0 data: Same model (Opus 4.6) on ForgeCode scores 79.8% vs. 75.3% on Capy — 4.5pp spread from harness alone.

### PRD Implication

**✅ Moat framing confirmed.** Executive Summary moat language should name: Model-Harness-Fit discipline, co-evolution feedback loop, citation-discipline per provider, and organism pattern as the four pillars.

---

#### M-2 — Memory ROI: When Does the Plugin Start Paying for Itself?

**Query:** At what session count does persistent memory become visibly valuable to a developer?

### Findings

- **Session 2:** First visible inflection — agent already knows auth middleware, jose choice, test coverage patterns from Session 1. User experiences zero re-explanation.
- **240 observations / ~3 sessions:** Efficiency inflection. CLAUDE.md at this scale = 22K+ tokens. agentmemory = ~1,900 tokens (92% reduction). Token cost advantage becomes material.
- **Semantic inflection (~3 sessions):** BM25+vector+graph retrieval begins surfacing cross-session patterns (e.g., finds "N+1 query fix" via "database performance optimization" search — keyword matching cannot do that).
- Human latency savings begin at Session 1 (eliminates the 5-minute re-explanation cost). Token cost savings begin materializing at ~3 sessions.

### PRD Implication

**✅ NFR target grounded.** Plugin value is visible before the cold-start hurdle clears. On-ramp UX should make Session 1 → Session 2 transition legible to the user (e.g., a status message at Session 2 start: "I remember your auth setup from last session").

---

#### M-3 — Distribution & Adoption: What Kills Plugin Adoption?

**Query:** What are the primary adoption blockers for Claude Code plugins, and how are they mitigated?

### Findings

- **npx cold-cache = adoption blocker:** Cold npm install can exceed Claude Code's 30s MCP_TIMEOUT. User sees "plugin failed to start" and abandons. Mitigation: global install (`npm i -g`) bypasses npx on every cold session.
- **Native dependency friction:** Any plugin requiring native binaries (C++ addons, Rust) adds OS-specific friction. Pure JS/TS plugins have substantially lower drop-off.
- **5-minute human latency savings** is the strongest value prop for developer buy-in — not token cost (which is invisible) but observable time savings.
- **30-second demo seeding** (agentmemory pattern): seeds 3 realistic sessions on install, allows user to experience semantic recall immediately without waiting for real sessions. Converts skeptics before they abandon.
- Documented install targets: `npm i -g` preferred over `npx skillkit install` for cold-start reliability.

### PRD Implication

**⚠️ Installation NFR needed.** Add NFR: "Plugin MUST install via global npm (`npm i -g`) as the recommended path; npx fallback MUST be documented but NOT the default. First-run experience MUST complete in <30 seconds and demonstrate recall from seeded data."

---

#### M-4 — Competitive Timing: Is the Market Moving to Native Routing?

**Query:** Are native providers already shipping multi-model routing? What is the competitive timeline pressure?

### Findings

- **Copilot CLI already ships multi-model routing (2026):** v1.0.32 added auto-mode for per-session model selection. Per-model tool surface (apply_patch for Codex, Edit/Write for Claude), per-model ToolSearch loading, Critic agent for Claude only.
- **Gartner 2027:** 3x enterprise SLM adoption predicted. First-party routing pressure accelerating.
- **50% localmaxxing threshold:** ~50% of daily developer tasks are local-suitable (email, scheduling, simple scripts, boilerplate). This is the threshold where first-party local routing becomes a meaningful value proposition to ship.
- Native providers shipping harness-aware routing means Metis must differentiate on: per-codebase routing intelligence (bandit learning), T2/T3 reward signals that native providers don't track, and the plugin-layer sovereignty (doesn't require changing the primary harness).

### PRD Implication

**⚠️ Competitive positioning needs updating.** PRD Competitive Context section should name Copilot CLI v1.0.32 as the live competitive precedent and distinguish Metis on bandit learning + codebase-specific T2/T3 signals as the non-replicable differentiator.

---

#### M-5 — Circuit-Breaker Patterns for Auto-Disable *(RESOURCE_EXHAUSTED — not retrieved)*

---

#### M-6 — Token Cost Methodology: What Are the Real Numbers?

**Query:** What is the documented annual token cost of CLAUDE.md-only memory vs. agentmemory? What does 90% cloud reduction mean in practice?

### Findings

- **$10/yr vs $500/yr:** agentmemory's 92% reduction at 240 observations translates to ~$10/yr for memory context vs. ~$500/yr for CLAUDE.md-everything-loaded-all-the-time at similar scale.
- **90% cloud cost reduction from local routing:** Routing narrow/routine tasks (50% of daily volume) to a local SLM eliminates cloud inference cost for those tasks. For developers running 8+ agentic sessions/day, this is material.
- **$15-25/PR:** Anthropic's Claude Code Review (multi-agent) averages $15-25 per review on top of Team/Enterprise seat. This is the cloud-heavy end of the cost spectrum that local routing addresses for routine code checks.
- Absolute numbers: 240 observations → 22K tokens (CLAUDE.md) vs ~1,900 tokens (agentmemory). The 92% reduction is at developer-scale, not toy scale.

### PRD Implication

**✅ Cost section grounded.** NFR/Success Metrics section should cite $10/yr vs $500/yr as the memory cost target range, and 90% cloud cost reduction on narrow tasks as the local-routing value proposition. Attribute to agentmemory data at 240 observations.

---

#### M-7 — Team Memory Threshold *(RESOURCE_EXHAUSTED — not retrieved)*

---

#### M-8 — Bandit Cold-Start: What Is the Empirical Probe Threshold?

**Query:** How many probes/experiments are needed before bandit routing becomes reliable?

### Findings

- **8–12 probes per improvement pass:** For single-agent auto-improvement loops. Minimum reliable signal for golden-path + edge cases + adversarial probes.
- **30+ experiments:** Needed to clear the noise floor for complex research tasks with environmental variance. Below 30, results are within the 30% variance range (see Q2/W-7).
- **Shared contract accelerates cold-start:** Providing predefined business rules at the first delegation ("what 'good' means for this task type") reduces cold-start probes needed by grounding the agent from turn 1.
- Adversarial scoring within the probe set (prompt injection, malformed input, off-purpose attempts) is the documented pattern for evaluating cold-start routing reliability.

### PRD Implication

**✅ Cold-start threshold documented.** PRD can cite 8–12 probes as the minimum bandit warm-up per task_type × provider arm. Q_INIT_PRIORS should converge toward reliable routing by probe 12 for narrow tasks; wide exploration window needed for Ollama through probe 30.

---

#### M-9 — Routing Transfer Risks

**Query:** What are the risks when a bandit learns routing priors from one codebase and is applied to a different one?

### Findings

- **Tool format overfitting:** Model trained on harness A's tool verbs (e.g., `apply_patch`) applied to harness B degrades silently — extra reasoning tokens + increased error rate documented at scale across millions of agent turns.
- **Legacy design system drift:** Agent learns "use Ant Design" from old sessions, applies it to a migrated codebase. Compiles fine, renders fine. Migration silently reversed.
- **Legacy bug contamination:** Agent trained on codebase A learns to replicate its bugs (e.g., a specific auth pattern with a known flaw). Transfer to codebase B inherits the bug.
- **Brittle file recognition:** Routing priors based on file path patterns (e.g., "everything in `/api/` is simple routing") break when the codebase is reorganized.
- 30+ experiments are needed to clear these transfer artifacts when deploying to a new codebase.

### PRD Implication

**⚠️ Per-codebase isolation required.** Bandit arms must be scoped per-codebase (project path), not shared globally. `reflect()` should detect codebase switches and reset/widen priors accordingly. Add to §TS-1 stubs.

---

#### M-10 — npm Install Adoption Evidence *(RESOURCE_EXHAUSTED — not retrieved)*

---

### Architecture Findings (W-1 through W-10)

---

#### W-1 — MCP Delegation: The stdio/JSON-RPC Contract

**Query:** How does a Claude Code plugin structure an MCP delegation call to an external provider?

### Findings

- **Copilot CLI supervisor protocol:** Spawns sub-provider binary as subprocess, opens `vscode-jsonrpc` channel over stdio, sends `session.create` with full config: model, system message, tools, MCP servers, skill directories, hook flags.
- **Codex app server mode:** Built-in headless mode for programmatic control. Well-documented JSON-RPC API for starting threads and reacting to turns. More scalable than tmux/CLI interaction.
- **Agent tool schema (Claude Code):** `description`, `prompt`, `subagent_type` (teammate/fork/worktree), optional `model`. Post-training has model emit short imperative descriptions.
- **Ollama:** Primarily an embedding provider; task delegation requires an MCP bridge that translates standard MCP calls to local REST API (`POST http://localhost:11434/api/generate`).
- **Copilot CLI store_memory:** Memory is remote-backend, not local files. Agent hangs on first turn if backend is unavailable (v1.0.23 fixed). Load-bearing dependency.

### PRD Implication

**✅ Delegation architecture grounded.** Teammate subagent model is the correct pattern for multi-provider delegation. Metis must handle each provider's native protocol: Codex via JSON-RPC app server, Ollama via REST bridge, Copilot CLI via supervisor protocol.

---

#### W-2 — Delegation Contract Details

**Query:** What is the full stdin/stdout contract for task delegation including context injection?

### Findings

- **session.create message structure:** Contains model, system message, available tools, MCP servers, custom agents, skill directories, hook flags.
- **Teammate model for multi-provider:** Spawns sub-agent with fresh context window — no transcript bias, no cache to break, native tool surface from turn 1. Explicitly inject `CLAUDE.md` and project context into the sub-session's starting prompt.
- **Fork model for Claude-to-Claude only:** Byte-identical parent context copy. Uses `SYSTEM_PROMPT_DYNAMIC_BOUNDARY` for prompt caching. Near-zero marginal cost for forked sub-agents.
- **Identity file convention:** `CLAUDE.md`, `AGENTS.md`, `SOUL.md`, `USER.md` — file names are load-bearing across the ecosystem. Sub-provider identifies context authority by file name.
- **Copilot CLI store_memory dependency:** Sub-agent invoking store_memory expects the remote backend to be present. Must ensure connectivity or explicitly disable memory for isolated delegations.

### PRD Implication

**✅ Context injection pattern confirmed.** Teammate subagent with explicit context injection (CLAUDE.md + project facts) is the correct delegation pattern. Fork is cost-optimal but only valid for same-model (Claude) sub-delegations.

---

#### W-3 — Session Initialization: What Should `reflect()` Do?

**Query:** What should a SessionStart initialization function do in a Claude Code harness?

### Findings

- **Live repo context loading:** Git branch, recent commits, directory listing loaded at session start to prevent hallucination about repo structure.
- **SYSTEM_PROMPT_DYNAMIC_BOUNDARY:** Static instructions (behavioral rules, safety) placed above boundary (globally cached); per-session context (CLAUDE.md, MCP servers, environment) injected below boundary.
- **SessionStart hook captures:** Project path + session ID. Identity capture grounds the interaction in a specific workspace.
- **4-tier memory population:** Working → Episodic → Semantic → Procedural. `autoDream` consolidation runs as a forked subagent during idle/init periods.
- **3-layer index:** Index (always loaded, ~150 chars/line), topic files (loaded on demand), transcripts (never loaded, only grep'd). Index is cheap; topic files fetched only when relevant.
- **Adversarial reversion detection:** Scoring subagents with "disprove" framing; PASS/FAIL loop reading session traces/logs; `record.json` audit receipts per iteration.

### PRD Implication

**✅ reflect() design confirmed.** At SessionStart, reflect() should: (1) load live repo context, (2) advance git cursor by reading recent commits, (3) run memory retrieval (BM25+vector+graph, top-K), (4) detect T3 reversions via git log comparison against last session's cursor. Add index-only memory loading as the injection pattern.

---

#### W-4 — Security Landscape: What Does the Threat Model Look Like?

**Query:** What is the documented threat landscape for AI coding agents from the March 2026 security incidents?

### Findings

- **March 2026 Security Disasters:** LiteLLM backdoor (3-stage: credential harvester for SSH/AWS/GCP/Kubernetes keys + systemd backdoor, live 3 hours); Codex command injection via unsanitized branch names (patched Feb 2026); GitHub Copilot injected promotional ads into 1.5M+ PRs as hidden HTML comments.
- **Axios trojan:** Maintainer account hijacked, RAT deployed across macOS/Windows/Linux, self-destructs after execution.
- **Why plugin registries are targets:** Skills carry implicit tool-call contracts. A malicious SKILL.md can use imperative instructions to execute `rm -rf /` or exfiltrate data under the guise of a routine task.
- **Dialect poisoning as attack surface:** Cross-harness skills that load OpenAI-targeted instructions into a Claude session cause quiet degradation — not a crash, but increased error rate and extra reasoning tokens.
- **Pattern registry = high-value target:** Unified skill/plugin registries are structurally similar to npm — a single point of trust that, if compromised, reaches every developer using the registry.

### PRD Implication

**⚠️ Risk register needs security section.** Add to PRD risk register: (1) SKILL.md prompt injection via malicious registry entry; (2) credential harvester risk during delegation (Layer 1 + Layer 2 blocklist is load-bearing); (3) dialect poisoning from cross-harness skill loading.

---

#### W-5 — Orchestration: Symphony vs. Interactive Gates at Scale

**Query:** How does Symphony compare to interactive plan gates as delegation scale increases?

### Findings

- **3–5 interactive sessions = human bottleneck limit:** Beyond this, human attention becomes the bottleneck, not the AI. Symphony decouples work from sessions by using Linear as a state machine.
- **500% PR increase** in 3 weeks after Symphony deployment at OpenAI. Interactive gates were the binding constraint.
- **Symphony as reference implementation:** Ticket status (Init → Plan → Executing → Review → Merging → Done) maps directly to agent lifecycle stages. Harness watches CI, rebases, resolves conflicts autonomously.
- **Ideal pattern = state machine + async Critic agents:** The plan gate is not abolished — it becomes async. The Critic agent verifies completion in the background; human only sees the output, not the verification session.
- **Cost of abandoning interactive gates:** Agents sometimes produce unexpected results without mid-flight correction. Symphony's answer: proof-of-work (CI status, PR review feedback, complexity analysis, walkthrough video) rather than interactive supervision.

### PRD Implication

**✅ Plan-gate design confirmed.** Plan-confirmation gate should be: synchronous for delegation decision, async for verification (Critic sub-agent reviews completion, not human). This preserves quality without creating a 3-5 session bottleneck.

---

#### W-6 — Event Detection: T2 Signals Without a Persistent Server

**Query:** How should Metis detect PR-merge events (T2 signals) without a persistent server process?

### Findings

- **Polling (Symphony v1):** Polling git/Linear for task status. Documented as "not particularly reliable" in early iterations.
- **KAIROS PR subscriptions:** Claude Code's unreleased KAIROS mode has a pull-request subscriptions tool that watches GitHub and reacts to code changes. Background loop with heartbeat prompt every few seconds.
- **Symphony/Linear as state machine:** T2 signal becomes "ticket reached Merging/Done status" rather than requiring the plugin to catch the exact merge event. Async and persistent-server-free.
- **SessionStart sync-on-start:** The documented pattern for non-persistent plugins: at SessionStart, load live repo context (git log, recent commits) to detect what merged since last session. `reflect()` advances the git cursor and generates T2/T3 signals from this diff.
- **Asymmetric persistence:** User messages synchronously awaited (production scar — process death between enter and API = lost session). Enables clean SessionStart recovery.

### PRD Implication

**✅ T2 detection via reflect() confirmed.** Metis should detect T2 signals at SessionStart by comparing current git log to last session's cursor. No persistent server required. Add `reflect()` cursor-advance logic as TS-REFLECT-1 stub.

---

#### W-7 — T3 Attribution: What Breaks Commit-Retention Signals?

**Query:** What specific failure modes exist for T3 commit-reversion attribution?

### Findings

- **Squash merge blur:** Separates "units of review" (granular agent commits) from "units of persistence" (single atomic commit in main). Code archaeologist cannot trace logic failures back to agent reasoning. T3 signal quality degrades.
- **Rename heuristics:** Git's snapshot model uses heuristics for rename detection. Extensive refactoring + file rename = misidentified as delete/recreate. Attribution chain broken.
- **Symphony autonomous rebasing:** Harness modifies code to resolve conflicts before merging. Final state reflects harness resolution logic, not agent contribution. T3 signal poisoned.
- **Verification laziness → async reversion:** Agent implements A', passes weak tests, declared done (T1 signal fires). Weeks later human discovers A' violates architectural assumptions. Revert. T3 signal fires async.
- **30% inference variance:** Noisy neighbor on shared EC2 shows "+2.1% improvement" that's within noise. Performance regression revert may be false-positive attribution.
- **Legacy bug contamination:** Pre-existing bugs flagged on PRs that merely touch (but don't introduce) the problematic file. T3 reversion may punish agent for debt it didn't create.

### PRD Implication

**⚠️ T3 signal has 6 documented failure modes.** PRD must add decay/attenuation logic: T3 signals from squash-merged PRs should have lower confidence weight. T3 signals from reverting complex multi-file changes should trigger `failure_class: legacy_contamination` investigation before penalizing the provider arm.

---

#### W-8 — Provider Selection: "Picking a Product" vs. Routing a Model

**Query:** How do the most mature multi-model routing systems frame the provider selection decision?

### Findings

- **"Picking a product, not just a model":** Copilot CLI explicitly exposes provider selection as a product choice (Claude on Copilot, GPT on Copilot). No neutral common denominator. Each requires a unique tool surface, memory ritual, and skill format.
- **Separate full stack per model:** The reference implementation (Copilot CLI) maintains per-model tool inclusion, per-model ToolSearch loading, and a Critic agent only for Claude models.
- **Harness-aware routing:** Model-Harness-Fit measured at scale across millions of agent turns. Unfamiliar tool format = extra reasoning tokens + increased error rate. Not a subtle effect.
- **Co-evolution feedback loop:** The harness that ships the most model-aligned tool surface earns stronger post-training alignment in the next model generation. "Swapping orchestrators is not a cosmetic change. It is a model swap in disguise."

### PRD Implication

**✅ Per-provider dialect requirement confirmed.** Metis must serve each provider its native tool dialect when delegating. This is not a nice-to-have — it's the only way to get top performance from each provider. Add as a hard constraint in the Delegation Architecture section.

---

#### W-9 — Plugin Marketplace Trust Surface

**Query:** What attack surfaces does a plugin marketplace introduce and how should they be defended?

### Findings

- **Supply chain hijacking:** LiteLLM/Axios precedents. Even popular tools (97M/100M downloads) can be backdoored. Credential harvesters target SSH keys, AWS/GCP/Azure, Kubernetes configs, LLM API keys.
- **SKILL.md prompt injection:** Skills carry implicit tool-call contracts. Malicious skill uses imperative instructions to execute harmful commands under the guise of routine tasks.
- **Critic side-query pattern:** Before executing any command from an external plugin, send intent to a separate, stronger model: "Is this command safe?" Replaces brittle allowlists with adaptive, context-aware security.
- **Adversarial scoring:** Scoring subagents spawned specifically to disprove the safety of proposed actions. Only actions surviving the challenge at 80+ confidence allowed.
- **Structural sandboxing:** OS-level isolation (Codex pattern) preferred over application-level checks. prctl(2) parent death signal for child processes.
- **Implicit contract verification:** A plugin marketplace is a routing problem — each skill must declare its target harness explicitly, or be rewritten per harness, or run inside a router that translates tool calls.
- **GitNexus supply-chain attestation:** Signed Docker images with Cosign keyless signing, SBOM attestations, Kubernetes admission controller enforcement.

### PRD Implication

**⚠️ Security requirements need expansion.** The two-layer credential blocklist is necessary but not sufficient. Add: (1) Critic side-query for any external skill invocation; (2) implicit contract verification (harness-dialect check before loading external skills); (3) supply-chain attestation requirements for any marketplace listing.

---

#### W-10 — GitNexus + agentmemory: Complementary or Competing?

**Query:** How do structural code intelligence and session memory interact? Is there overlap?

### Findings

- **Complementary, not competing:** agentmemory = chronological "what happened" (session memory, observations, patterns). GitNexus = structural "what is there" (AST, process flows, blast radius, community detection via Leiden algorithm).
- **GitNexus fills agentmemory's blind spot:** Session memory knows you touched `auth.ts` 3 sessions ago. GitNexus knows that `auth.ts` is part of a 12-function process flow with 7 dependents, and changing `validateToken` has a blast radius of 23 files.
- **PreToolUse/PostToolUse integration:** GitNexus hooks enrich searches with graph context (PreToolUse) and detect stale index after commits (PostToolUse), prompting re-index.
- **Single-query blast radius:** A question like "what does changing this function break?" is a GitNexus query, not a session memory query. GitNexus precomputes relational intelligence from AST + community detection.
- **MCP complement:** GitNexus setup auto-detects editors, writes global MCP config once. agentmemory MCP is a separate server block.

### PRD Implication

**✅ Two-system architecture confirmed.** Metis memory design should use agentmemory MCP for session/episodic/semantic memory + recommend GitNexus MCP as a complementary integration for structural analysis. The plan-gate Critic agent should have access to both: what happened (agentmemory) and what is affected (GitNexus blast radius).

---

### Engineering Findings (A-1 through A-10)

---

#### A-1 — Installation Engineering: MCP_TIMEOUT and Cold Cache

**Query:** What engineering constraints affect Claude Code plugin installation reliability?

### Findings

- **MCP_TIMEOUT 30s:** npx cold-cache install can exceed Claude Code's 30-second MCP_TIMEOUT default. Plugin appears to fail silently. User never gets to try it.
- **Global install bypass:** `npm i -g` writes absolute-path MCP config. Bypasses npx entirely. GitNexus and agentmemory both document this as the recommended install path.
- **Memory prefetch via `using` keyword:** TC39 explicit resource management. Ensures memory prefetch cleanup on all generator exit paths (normal completion, early abort, error). Hides I/O latency of memory loading during streaming response.
- **Progressive disclosure for skills:** ToolSearch deferred loading — expose only the discovery loop to Claude-trained models; OpenAI-trained models get full tool list up front.

### PRD Implication

**⚠️ Installation NFR added.** Global install (`npm i -g`) must be the documented primary install path. npx is a fallback only, with explicit timeout warning. Add to Installation Requirements section.

---

#### A-2 — T3 Attribution: Specific Engineering Failure Modes

**Query:** What are the specific technical failure modes for commit-retention attribution?

### Findings

- **Squash merge → units of review vs. persistence:** Git log/blame after merge cannot trace logic failures back to agent reasoning without opening the PR. Automated T3 attribution via `git log` is unreliable post-squash.
- **Rename detection heuristics:** Git snapshot model uses similarity heuristics. Extensive refactoring + rename = misidentified as delete/recreate. `git blame` chain broken.
- **Symphony autonomous rebasing:** Harness-level conflict resolution modifies the commit before it lands in main. The final commit's content reflects harness logic, not agent contribution. T3 signal measures harness behavior, not agent quality.
- **A' approximation → async T3:** Verification laziness means T1 fires (task declared done), T3 fires weeks later (human reverts A' for violating architectural assumptions). The gap between T1 and T3 makes causality attribution ambiguous.
- **30% noisy-neighbor variance:** Cloud VM performance variation means a "performance regression" triggering a revert may be a false positive from infrastructure noise, not agent-caused code quality.
- **Legacy contamination:** Pre-existing bugs surface when a PR touches (but doesn't introduce) a problematic file. T3 reversion punishes the agent for inherited debt.

### PRD Implication

**⚠️ T3 attribution must be probabilistic, not binary.** Add `t3_confidence` field to reward records. Attenuate T3 signals from: squash-merged PRs (lower confidence), large time gaps (>14 days), and PRs with `failure_class: legacy_contamination` flag.

---

#### A-3 — T2 Detection: Polling vs. Webhooks vs. SessionStart Sync

**Query:** What is the right T2 detection mechanism for a non-persistent CLI plugin?

### Findings

- **SessionStart sync is the recommended pattern for non-persistent plugins:** At SessionStart, load live repo context (current git branch, recent commits). Compare to last session's cursor. Delta = new merged PRs = T2 signal candidates.
- **Polling (Symphony v1):** "Not particularly reliable." Works but misses events between polling intervals.
- **KAIROS PR subscriptions:** Background heartbeat loop watches GitHub for PR events. Requires the KAIROS mode flag (currently feature-flagged, not public).
- **Webhooks require persistent server:** Multica uses `GITHUB_WEBHOOK_SECRET` for real-time streaming. Not viable for a standalone CLI plugin without managed infrastructure.
- **Asymmetric persistence as safety net:** User messages are `await`ed synchronously (production scar); if process dies mid-turn, SessionStart recovery can reconstruct state from the last persisted cursor.
- **Audit receipts:** `record.json` per iteration documents what was found, what changed, whether execution passed, what remains. Enables a later session to verify T2/T3 from the permanent audit trail.

### PRD Implication

**✅ T2 via reflect() at SessionStart confirmed.** SessionStart `reflect()` reads git log from last cursor, identifies merged PRs containing Metis-delegated commits (by author/branch pattern), fires T2 reward. No persistent server required.

---

#### A-4 — Process Lifecycle: Graceful Abort and Cleanup

**Query:** How should a Claude Code plugin handle Ctrl+C, SIGINT, and process death?

### Findings

- **`using` keyword (TC39 explicit resource management):** Ensures cleanup on all exit paths — normal completion, early abort, error. Used in Claude Code for memory prefetch cleanup during streaming.
- **prctl(2) parent death signal (Linux):** Codex sets parent death signal on spawned child processes. If main process dies, all children killed automatically. No orphan processes.
- **Asymmetric persistence:** User messages `await`ed synchronously; assistant messages async (already durable in API response). If plugin dies mid-delegation, the user's last message is persisted and recoverable at next SessionStart.
- **Abort signal chain:** When user interrupts, the plugin should: (1) finalize any in-flight memory writes, (2) write a partial audit receipt to the T2/T3 pending table, (3) release any exclusive action leases held in agentmemory.

### PRD Implication

**✅ Abort handling design confirmed.** Plugin must: use `using` for resource cleanup, implement synchronous T2/T3 pending-state writes before exit, and release memory leases on abort. Add to §TS-1 engineering stubs.

---

#### A-5 — PreToolUse Credential Scanning

**Query:** How should Layer 2 blocklist enforcement work at the PreToolUse hook level?

### Findings

- **Pattern-based stripping at PreToolUse:** agentmemory applies centralized patterns to strip API keys, secrets, `<private>` tags from prompts and injected context before tool execution or logging.
- **File access pattern capture:** PreToolUse hook records which files the tool is attempting to access. Sensitive files (`.env`, `.ssh/config`) trigger blocklist check before the operation proceeds.
- **Critic side-query as Layer 2:** "Is this command safe?" sent to a separate, stronger model before high-risk tool execution. Evaluates user intent, working directory, full context. Replaces brittle static allowlists.
- **Adversarial scoring:** Scoring subagents spawned to disprove safety of proposed action. Actions below 80pt confidence threshold are blocked. Not a binary allow/deny.
- **Permission pipeline:** mode check → hook evaluation → rule matching → user prompt. Denial wrapped as tool result ("permission denied") fed back to model so it can adjust its approach rather than crashing.
- **Identity-driven enforcement:** `CLAUDE.md` headings treated as binding instructions. `# auto memory` overrides default behavior. Behavioral boundaries injected via identity files.

### PRD Implication

**✅ Layer 2 design confirmed.** Layer 2 should be: PreToolUse pattern-based stripping (credential regex) + Critic side-query for external delegations (not brittle allowlists). Failure surfaced as tool-result error, not crash. Add TS-SECURITY-1 stub.

---

#### A-6 — Plan Review: AST-Aware Critic and Confidence Thresholds

**Query:** How should the plan-confirmation Critic use structural code intelligence?

### Findings

- **Critic side-query > regex allowlists:** Static scanning misses dynamically constructed paths, unmounted security guards, and context-dependent permissions. The Critic pattern (LLM side-query: "Is this safe?") catches what static patterns miss.
- **GitNexus AST blast radius at plan review time:** Before confirming a plan, the Critic should query GitNexus for the blast radius of proposed changes. A plan that claims "modify auth.ts" but has a blast radius of 23 files is high-risk and should require explicit acknowledgment.
- **80pt adversarial confidence cutoff:** Scoring subagents attempt to disprove the plan. Only plans surviving at 80+ confidence proceed. Below 80pt = rejected with reasoning surfaced to user.
- **Pre-existing bug contamination filter:** Critic must distinguish between bugs introduced by the plan vs. pre-existing bugs in files the plan touches. Surfacing both without distinguishing creates overhead.

### PRD Implication

**✅ Plan-gate Critic design confirmed.** Plan-confirmation gate should: (1) invoke Critic side-query with full plan context, (2) check GitNexus blast radius (if available), (3) apply 80pt adversarial confidence threshold. Explicit acknowledgment required for high-blast-radius plans.

---

#### A-7 — SQLite Migration Strategy

**Query:** How should Metis manage SQLite schema migrations safely?

### Findings

- **Numbered sequential scripts:** Codex pattern — `0016_memory_usage.sql`, `0029_thread_goals.sql`. Numbered order-of-execution, git-versioned, human-readable.
- **ADD COLUMN for no-loss alterations:** `ALTER TABLE stage1_outputs ADD COLUMN usage_count INTEGER; ADD COLUMN last_usage INTEGER;` — does not drop data, backward-compatible with older plugin versions.
- **Git-versioned snapshots + JSON export/import:** Memory state snapshot before migration run. If migration corrupts, rollback to git snapshot. Export/import as JSON for cross-version portability.
- **agentmemory upgrade + memory_heal:** agentmemory ships a `memory_heal` tool that auto-fixes stuck state after upgrades. Pattern: run upgrade, run memory_heal, verify health.
- **Schema validation at startup:** `additionalProperties: false` on Codex's memory artifact schema. Rejects malformed output at parse time, preventing silent data corruption.

### PRD Implication

**✅ TS-MIGRATE-1 confirmed.** Schema migration strategy: numbered SQL scripts, ADD COLUMN only (no DROP), git-versioned snapshots before each migration, memory_heal equivalent for post-migration recovery. Add as v1 deliverable in §TS-1.

---

#### A-8 — Subagent Models: Fork vs. Teammate vs. Worktree

**Query:** Which subagent execution model should Metis use for multi-provider delegation?

### Findings

- **Fork = byte-identical cache reuse:** Parent context copied. Used for background summarization, memory extraction, parallel Claude-to-Claude analysis. Near-zero marginal token cost.
- **Teammate = fresh context + native dialect:** Spawns sub-agent with clean context window, no transcript bias, native tool surface from turn 1. **Correct model for multi-provider delegation** (Codex, Ollama, Copilot CLI).
- **Worktree = git structural isolation:** `git worktree add` creates isolated physical directory. Used for parallel implementations with file-system-level isolation.
- **The mismatch failure mode:** Running a Codex-trained model on Claude Code's harness — model looks for a memory write tool, finds Write, and uses it to write a `.mem` file instead of calling `store_memory`. Memory corruption without error.
- **Cursor's documented principle:** "Spawn a subagent with a different model rather than switch the main conversation."

### PRD Implication

**✅ Teammate model is the correct delegation pattern.** All Metis delegations to external providers (Codex, Ollama, Copilot CLI) must use the teammate subagent model. Fork is only valid for same-model (Claude) background tasks. Add as an explicit constraint in Delegation Architecture.

---

#### A-9 — Telemetry Schema: What to Measure

**Query:** What telemetry schema should Metis implement for routing intelligence?

### Findings

- **OTEL waterfall traces:** agentmemory ships OTEL observability out of the box — every memory operation as a waterfall/flame trace. No instrumentation required.
- **usage_count / last_usage (Codex migration 0016):** Per-memory-artifact decay tracking. If usage_count never bumps (e.g., due to citation tag blindness), artifact is evicted by decay loop.
- **Citation tag tracing:** Track whether Metis's injected context is being cited by the model. If citation rate drops, memory injection quality has degraded.
- **R@5 / MRR retrieval accuracy:** LongMemEval-S benchmarks for memory retrieval quality. agentmemory: 95.2% R@5, 98.6% R@10, 88.2% MRR.
- **80pt confidence threshold as noise-reduction telemetry:** Findings below threshold = noise floor. Track the ratio of filtered-to-passed findings to detect routing quality degradation.
- **TTFT, TPS, ITL:** Time to first token, tokens per second, inter-token latency. Inference latency metrics for local vs. cloud provider comparison.

### PRD Implication

**✅ Telemetry schema grounded.** NFR: Metis should instrument: (1) usage_count per injected memory artifact, (2) citation rate per delegation, (3) confidence score distribution per task_type × provider, (4) TTFT/TPS for each provider arm. OTEL via agentmemory covers (1) and (2) automatically.

---

#### A-10 — Config Validation: JSONC Schema and Error Surfacing

**Query:** How should Metis validate its configuration file and surface schema errors?

### Findings

- **JSONC preferred format:** JSON with Comments allows documenting routing rules directly in the config file while maintaining machine-readability. Caveman implements JSONC settings helpers.
- **Strict schema enforcement:** `additionalProperties: false` in JSON schema. Malformed output rejected at parse time. Prevents "quiet degradation" from typos in config keys.
- **Error-as-result pattern:** Config validation errors wrapped as tool results (Claude Code permission pipeline pattern). Model sees "invalid config schema: unknown key 'providr'" and can adjust.
- **`doctor` command:** claw-code pattern — `claw doctor` validates API key, model access, tool configuration. First health check after install. Metis should implement `/metis:help` with a health-check mode.
- **Diagnostic tables:** Symptom/fix tables (agentmemory pattern) for common failure modes (port conflicts, engine crash, Docker fallback). Reduces support burden.
- **Automated merging:** Config installer should merge into existing mcpServers object, not replace the entire file. Preserves other installed plugins.

### PRD Implication

**✅ Config validation design confirmed.** Metis config: JSONC format, strict schema (`additionalProperties: false`), validation error surfaced as structured feedback (not crash), `/metis:help` should include health-check mode equivalent to `claw doctor`.

---

### Product / UX Findings (J-1 through J-9)

---

#### J-1 — Routing Legibility: What Should Users See?

**Query:** What information makes a routing decision legible and trustworthy to a developer?

### Findings

- **4-criteria legibility framework:** Scope (narrow vs. broad), Harness-Fit (does the provider natively handle this tool dialect?), Cost/Latency (cloud vs. local tradeoff), Context Health (how much context window pressure is involved).
- **Honest dialect disclosure:** System should not claim "translated to common format." It should disclose "routed to Ollama in its native format (REST, simple prompt)" vs. "routed to Codex in app-server mode with apply_patch."
- **Routing decision trail:** Not just "routed to X" but "routed to X because: scope=narrow, 3/4 criteria matched, Ollama Q-value=0.72."
- **Provider performance badge:** Real-time quality score per provider per task type, surfaced in `/metis:status`.

### PRD Implication

**✅ /metis:why design confirmed.** `/metis:why` should surface: the 4-criteria routing decision, the provider's current Q-value for this task_type, and the confidence score. Not just "routed to Ollama" but the reasoning chain.

---

#### J-2 — Cold-Start UX: First-Run Trust Building

**Query:** How should Metis build trust before the bandit has accumulated meaningful signal?

### Findings

- **30-second demo seeding:** agentmemory pattern — seed 3 realistic sessions on install. User experiences semantic recall immediately without waiting for real sessions to accumulate.
- **"Small shared contract" pattern:** Provide predefined business rules at the first delegation. Grounds the agent's routing and reasoning from turn 1 rather than requiring the bandit to infer everything.
- **Status badge for cold-start:** During cold-start period (< 8 probes per arm), display a "learning" indicator. Caveman pattern: statusline badge showing cumulative savings. Metis equivalent: `[METIS] ⚡ learning (12/30 probes)`.
- **Conservative priors during cold-start:** Q_INIT_PRIORS should default to cloud (known-good) during cold-start. Bandit only routes to local/alternate provider when confidence is above threshold.

### PRD Implication

**✅ Cold-start UX design confirmed.** First-run should: seed 3 realistic sessions, show a "learning" status badge, and default to conservative (cloud) routing until 8 probes/arm have accumulated. `/metis:status` should surface probe count during cold-start.

---

#### J-3 — (Not in batch — J-3 was not in the 39-query list)

---

#### J-4 — On-Ramp Banner: Introducing Routing to New Users

**Query:** What UX patterns exist for introducing AI routing to developers via a CLI plugin first-run experience?

### Findings

- **"Honest product choice" framing:** Leading research says routing should be presented as picking a matched pair, not a neutral model swap. "Claude on Metis" and "Codex on Metis" are different products.
- **Picker + Auto mode:** Copilot CLI exposes a manual picker (Sonnet/Opus/Haiku/GPT-5.x family) plus auto mode (v1.0.32). Metis equivalent: `--provider=auto` as the default, with `--provider=ollama` as explicit opt-in.
- **30-second demo path:** agentmemory seeds 3 realistic sessions. User sees semantic recall before committing. Converts skeptics without requiring 10–20 real sessions.
- **`doctor` health check as first action:** claw-code pattern — `claw doctor` validates environment before first use. Metis: `/metis:help` with health-check mode.
- **Cumulative value badges:** Caveman's `[CAVEMAN] ⛏ 12.4k` statusline badge. Persistent non-intrusive signal of compounding value.

### PRD Implication

**✅ On-ramp UX design confirmed.** First-run experience: (1) health check via `/metis:help` doctor mode, (2) 30s demo seeding if desired, (3) statusline badge showing cumulative routing decisions + estimated savings, (4) `--provider=auto` default with transparent routing log.

---

#### J-5 — /metis:status: What State to Surface

**Query:** What should `/metis:status` display?

### Findings

- **5-dimension status surface:** (1) Runtime health (daemon PID, worker status, MCP connectivity), (2) Routing decisions (active dialect, auto/manual mode, Critic override), (3) Memory health (session count, index staleness vs. git HEAD, retrieval accuracy), (4) Economic telemetry (cumulative token savings, TTFT/TPS per provider), (5) Learning progress (probe count per arm, Q-values per task_type, recent T2/T3 signals).
- **agentmemory://status resource:** Ships out of the box — health, session count, memory count. Directly consumable.
- **Context anxiety meter:** Percentage of context window consumed. At 95% = compaction imminent. Surface as a warning in status.
- **Routing confidence distribution:** Histogram of confidence scores over last N delegations. If distribution shifts toward speculative (0.3–0.49), routing quality is degrading.

### PRD Implication

**✅ /metis:status design grounded.** `/metis:status` should display: provider health, current Q-values per active task_type, probe count (cold-start indicator), memory health (agentmemory://status), and recent T2/T3 signals. 5 dimensions, progressive disclosure (compact default, verbose with `--detail`).

---

#### J-6 — Plan Gate Cognitive Cost: Bottleneck or Safety Net?

**Query:** At what delegation volume does the plan-confirmation gate become a bottleneck?

### Findings

- **3–5 interactive gates = human attention limit:** Beyond this count per session, developer attention is the binding constraint. Symphony's solution: async gates (Critic verifies in background, human only sees results).
- **500% PR increase** from removing synchronous interactive gates (Symphony at OpenAI).
- **80pt threshold removes noise:** At 80pt confidence, human only sees findings that have survived adversarial scoring. Reduces false-positive interruptions significantly.
- **Gate types that remain worthwhile:** (1) Plan confirmation before first delegation (establishes algorithmic contract), (2) High-blast-radius changes (GitNexus confirms before proceeding), (3) Cross-codebase or ambiguous task types. Everything else should be async Critic + auto-proceed.

### PRD Implication

**⚠️ Plan gate should be synchronous only for first delegation per session + high-blast-radius tasks.** Subsequent confirmations in the same session should use async Critic (auto-proceed if >80pt). Add this distinction to the Plan-Confirmation Gate spec.

---

#### J-7 — Reject-and-Reroute UX: What to Show When Routing Fails

**Query:** What should the UX look like when a routing decision fails mid-task?

### Findings

- **Teammate subagent dispatch, not mid-chat model swap:** Switching models in an existing conversation breaks prompt cache (guaranteed cache miss), contaminates transcript with foreign tool calls, and presents the wrong tool surface. Spawn a fresh teammate subagent with the fallback provider instead.
- **Honest product-level handoff:** UI should disclose "switching from Ollama to Claude (cloud)" as a product-level transition, not just "retrying with a different model."
- **Cursor's mitigation for mid-chat swap:** Injects "you are taking over mid-chat from another model" instruction + steers away from prior model's tools. Mitigates but doesn't eliminate transcript pollution.
- **Fallback transparency:** Surface: (1) Critic reasoning that triggered the rejection, (2) confidence score that fell below threshold, (3) which routing criteria failed, (4) estimated cost delta of the fallback.
- **Cache miss cost:** A fallback to a different provider = guaranteed cache miss. UI should communicate if the reroute requires full-price re-entry of system prompt and history.

### PRD Implication

**✅ Fallback UX design confirmed.** Fallback = spawn teammate subagent with fallback provider (not mid-chat swap). Surface: rejection reason, confidence score, cost delta. Add this to the Delegation Error Handling spec.

---

#### J-8 — /metis:forget: Memory Deletion UX

**Query:** How should `/metis:forget` present and confirm memory deletion?

### Findings

- **4-tier deletion targeting:** Users should be able to delete by tier — Working (raw observations), Episodic (session summaries), Semantic (extracted facts), Procedural (workflow patterns) — not just "clear everything."
- **Governance audit trail:** `memory_governance_delete` tool logs every removal with timestamp and reason. Deletion is a traceable event, not silent erasure.
- **Selective filters:** Session-based (forget a specific off-track session), file-specific (forget all observations about a deleted file), fact-specific (forget a stale architectural pattern).
- **Git-versioned snapshots as safety net:** Memory state snapshotted before deletion. User can roll back if agent performance degrades after forget.
- **Blast-radius preview:** Show what other memories depend on the targeted entry (evidential gap analysis). Prevents users from accidentally creating logical inconsistencies in the agent's understanding.

### PRD Implication

**✅ /metis:forget design grounded.** `/metis:forget` should: show a preview of what will be removed (by tier), display dependent memories that will be affected, require confirmation for semantic/procedural tier deletions, write a governance audit entry, and create a git snapshot before executing.

---

#### J-9 — Off-Ramp Hints: Surfacing Exit Points Without Breaking Flow

**Query:** How should Metis hint users toward disabling or adjusting routing when the AI is underperforming?

### Findings

- **Confidence scoring as implicit hint:** If multiple findings in a session fall into the speculative (0.3–0.49) or misguided (<0.29) credibility range, surface a "routing quality warning" rather than waiting for the user to notice.
- **Context anxiety meter:** As the context window approaches 95% capacity, surface a compaction hint. If the agent is showing "complexity fear" (declaring tasks out of scope, writing stubs), suggest a session handoff.
- **Statusline badge degradation signal:** If the caveman-style savings badge starts showing lower efficiency (or negative delta), it's an implicit signal that routing is producing overhead rather than savings.
- **"Normal mode" escape hatch:** Analogous to caveman's "stop with 'normal mode'" instruction. Metis should support `/metis:do --provider=claude` as an explicit override that bypasses routing for a single task.
- **Sprint decomposition hint:** When an agent exhibits complexity fear (declares task "out of scope"), suggest breaking the task into sub-hundred-line subtasks via the Symphony/Linear state machine pattern.
- **Session handoff as soft escape:** When context anxiety is detected, suggest `--fresh-session` to spawn a clean teammate subagent with the current plan as a handoff artifact.

### PRD Implication

**✅ Off-ramp UX design confirmed.** Metis should implement: (1) confidence degradation warning (implicit hint at speculative results), (2) context anxiety meter in `/metis:status`, (3) `/metis:do --provider=claude` as explicit routing bypass, (4) session handoff suggestion at 80% context capacity.

---

## Round 2 Summary Scorecard

| ID | Topic | Verdict | PRD Change Required |
|---|---|---|---|
| M-1 | Competitive moat | ✅ Model-Harness-Fit + co-evolution loop confirmed | Update Executive Summary moat language with 4-pillar framing |
| M-2 | Memory ROI timeline | ✅ Session 2 visible; 240 obs efficiency inflection | Add Session 2 milestone to on-ramp UX; NFR: visible value before cold-start clears |
| M-3 | Distribution/adoption | ⚠️ npx cold-cache = adoption killer | Add NFR: global install as primary path; <30s first-run |
| M-4 | Competitive timing | ⚠️ Copilot CLI already ships multi-model routing | Update Competitive Context: Copilot CLI v1.0.32 as live precedent |
| M-5 | Circuit-breaker auto-disable | ❌ Not retrieved | Commission Q9 equivalent before architecture review |
| M-6 | Token cost numbers | ✅ $10/yr vs $500/yr; $15-25/PR for cloud review | Cite in NFR/Success Metrics; 90% cloud cost reduction on narrow tasks |
| M-7 | Team memory threshold | ❌ Not retrieved | Commission separate query |
| M-8 | Bandit probe threshold | ✅ 8–12 probes minimum; 30+ for noisy environments | Q_INIT_PRIORS converge by probe 12; Ollama wider window to 30 |
| M-9 | Routing transfer risks | ⚠️ 4 named transfer risks; per-codebase isolation required | Add codebase-switch detection to reflect(); reset priors on new codebase |
| M-10 | npm install friction | ❌ Not retrieved | Commission separate query |
| W-1 | MCP delegation contract | ✅ stdio/JSON-RPC; Teammate for multi-provider | Teammate = correct delegation model (not fork) |
| W-2 | Delegation context injection | ✅ session.create schema; identity file convention | Explicit context injection (CLAUDE.md) required for teammate delegations |
| W-3 | reflect() design | ✅ Live repo + SYSTEM_PROMPT_DYNAMIC_BOUNDARY + 3-layer index | Add TS-REFLECT-1: git cursor advance + T2/T3 detection at SessionStart |
| W-4 | Security threat model | ⚠️ 5 named attack vectors from March 2026 | Add security section to risk register |
| W-5 | Symphony vs. interactive gates | ✅ Async Critic > synchronous gates at scale | Plan gate = sync for first delegation; async Critic for subsequent |
| W-6 | T2 detection mechanism | ✅ SessionStart git-cursor sync preferred | reflect() T2 detection confirmed; no persistent server required |
| W-7 | T3 attribution failure modes | ⚠️ 6 named failure modes; probabilistic T3 required | Add t3_confidence field; attenuate squash-merge and time-gap T3 signals |
| W-8 | Provider = product choice | ✅ Per-provider full stack; no common denominator | Delegation Architecture must serve native dialect to each provider |
| W-9 | Marketplace trust surface | ⚠️ SKILL.md injection, supply chain, dialect poisoning | Expand security requirements: Critic side-query for external skills |
| W-10 | GitNexus + agentmemory | ✅ Complementary; GitNexus = structural; agentmemory = chronological | Recommend GitNexus MCP as complementary integration |
| A-1 | MCP_TIMEOUT / install | ⚠️ 30s timeout = adoption blocker | NFR: global install primary path; add to Installation Requirements |
| A-2 | T3 attribution engineering | ⚠️ 6 technical failure modes | Add t3_confidence probabilistic weighting to reward schema |
| A-3 | T2 polling vs. webhook | ✅ SessionStart git-cursor sync confirmed | No persistent server; reflect() handles T2 detection |
| A-4 | Process lifecycle / abort | ✅ `using` keyword + prctl(2) + asymmetric persistence | Add abort cleanup to §TS-1 engineering stubs |
| A-5 | PreToolUse credential scan | ✅ Pattern stripping + Critic side-query + permission pipeline | Layer 2 = pattern stripping + Critic side-query; add TS-SECURITY-1 |
| A-6 | AST-aware plan review | ✅ Critic > allowlists; GitNexus blast radius; 80pt cutoff | Plan gate Critic: blast radius check + adversarial 80pt threshold |
| A-7 | SQLite migration strategy | ✅ Numbered scripts + ADD COLUMN + git snapshots | Add TS-MIGRATE-1: numbered SQL scripts, no-loss ALTER TABLE pattern |
| A-8 | Subagent model selection | ✅ Teammate = multi-provider; Fork = same-model only | Hard constraint: Teammate for all Codex/Ollama/Copilot delegations |
| A-9 | Telemetry schema | ✅ OTEL + usage_count + citation rate + 80pt distribution | NFR: instrument usage_count, citation rate, confidence distribution, TTFT/TPS |
| A-10 | Config validation | ✅ JSONC + strict schema + doctor command | Config: JSONC, `additionalProperties: false`, `/metis:help` health-check mode |
| J-1 | Routing legibility | ✅ 4-criteria framework | `/metis:why` should surface 4-criteria reasoning + Q-value + confidence |
| J-2 | Cold-start UX | ✅ 30s seeding + shared contract + conservative priors | First-run: demo seeding, "learning" badge, cloud-default priors during cold-start |
| J-4 | On-ramp banner | ✅ Honest product choice + auto/picker + doctor | First-run: health check, demo, statusline badge, `--provider=auto` default |
| J-5 | /metis:status state | ✅ 5 dimensions confirmed | `/metis:status`: 5-dimension display; compact default, `--detail` verbose |
| J-6 | Plan gate cognitive cost | ⚠️ Sync gate = bottleneck at scale | Gate: sync for first delegation + high-blast-radius; async Critic otherwise |
| J-7 | Reject-and-reroute UX | ✅ Teammate subagent dispatch; Critic reasoning surfaced | Fallback = teammate subagent; surface: rejection reason, confidence, cost delta |
| J-8 | /metis:forget UX | ✅ 4-tier categorization + governance audit + git snapshots | `/metis:forget`: tier-based preview, blast-radius warning, governance trail |
| J-9 | Off-ramp hints | ✅ Confidence degradation + context anxiety + bypass override | Add confidence warning, context anxiety meter, `/metis:do --provider=claude` bypass |

**Round 2 totals: 26 confirms ✅, 9 calibration changes ⚠️, 3 not retrieved ❌. No pivots.**

---

## Master PRD Revision Checklist (Round 1 + Round 2 Combined)

Priority order: sprint-blocking items first, then calibrations, then enhancements.

### Sprint-Blocking (Must land before architecture review sign-off)

1. **§TS-1 — TS-COMPACT-1:** Add PreCompact hook as sprint-blocking integration point for context re-injection. Static injection at session start will not survive reactive compaction.
2. **§TS-1 — TS-REFLECT-1:** Add reflect() as SessionStart function: (a) advance git cursor, (b) load live repo context, (c) detect T2 signals from merged PRs, (d) detect T3 reversions from commit history. No persistent server required.
3. **§TS-1 — TS-MIGRATE-1:** Add SQLite schema migration strategy as v1 deliverable: numbered scripts (0001_initial.sql, etc.), ADD COLUMN only for no-loss alterations, git-versioned snapshots before each migration run.
4. **§TS-1 — TS-SECURITY-1:** Add Layer 2 PreToolUse credential scanning: pattern-based stripping of API keys/secrets + Critic side-query for external delegations (not brittle allowlists).
5. **Delegation Architecture:** Hard constraint — all Codex/Ollama/Copilot delegations MUST use teammate subagent model (fresh context, native tool dialect). Fork is only valid for same-model (Claude) sub-delegations.

### Calibration Changes (Risk register and reward signal corrections)

6. **Risk Register:** Add plugin-layer citation/decay signal ceiling as named risk: "Plugin-layer memory cannot observe per-provider citation/decay signals. Routing intelligence for Codex and Copilot CLI will have noisier decay signal quality than a harness-native implementation."
7. **Risk Register:** Add security section with 5 named vectors from March 2026: SKILL.md prompt injection, supply chain credential harvesting, dialect poisoning, command injection via unsanitized parameters, Copilot-style hidden content injection.
8. **Reward Schema:** Add `t3_confidence` field to reward records. Attenuate T3 signals from: squash-merged PRs (lower weight), time gaps >14 days (lower weight), `failure_class: legacy_contamination` (investigative hold before penalizing provider arm).
9. **Ollama Q_INIT_PRIORS:** Narrow to narrow/routine tasks only. Start LOW for `code_review`, `multi_file_analysis`, `architectural_decision`. Add stddev tracking as routing signal alongside mean quality for Ollama arm (non-stationarity guard).
10. **Bandit Cold-Start:** Q_INIT_PRIORS converge toward reliable routing by probe 12 for narrow tasks; maintain wider exploration window for Ollama through probe 30 (environmental variance requires more observations).
11. **Per-Codebase Isolation:** Bandit arms scoped per-codebase (project path), not shared globally. reflect() detects codebase switches and resets/widens priors accordingly.

### Functional Requirements Additions

12. **FR-CRITIC-1 + AC-CRITIC-1:** Add Critic sub-agent adversarial verification to plan-confirmation gate. Gate = sync for first delegation per session + high-blast-radius tasks; async Critic (auto-proceed at >80pt) for subsequent delegations. This implements the Critic agent pattern from the sources.
13. **Plan-Confirmation Gate:** Connect explicitly to the adversarial 80pt confidence threshold. Plan survives → proceeds. Plan rejected → surface reasoning + confidence score to user.
14. **FR-CODEBASE-ROUTING:** Routing priors are per-codebase, not global. reflect() detects codebase switch via project path comparison, triggers prior reset, applies transfer-risk attenuation for 30 probes.

### Non-Functional Requirements Additions

15. **NFR-MEMORY-1:** ≤1,900 token memory injection ceiling per delegation (at 240 observations). Alert threshold: 2,200 tokens. Target: agentmemory MCP BM25+vector+graph retrieval (top-K, session-diversified, max 3 results per session).
16. **NFR-INSTALL-1:** Plugin MUST install via `npm i -g` as the recommended path. npx fallback documented but NOT the default. First-run experience MUST complete in <30 seconds.
17. **NFR-TELEMETRY-1:** Instrument: usage_count per injected memory artifact, citation rate per delegation, confidence score distribution per task_type × provider, TTFT/TPS for each provider arm. OTEL via agentmemory covers usage_count and citation rate automatically.

### Executive Summary / Positioning Updates

18. **Moat Language:** Update Executive Summary moat to name 4 pillars: (1) Model-Harness-Fit discipline (per-provider native dialect), (2) co-evolution feedback loop (harness traces → future model alignment), (3) citation-discipline per provider, (4) organism pattern (bugs → lint rules → structural defense).
19. **Competitive Context:** Add Copilot CLI v1.0.32 as live competitive precedent (multi-model routing, auto-mode, Critic agent for Claude only). Distinguish Metis on: bandit learning + codebase-specific T2/T3 signals as the non-replicable differentiator.
20. **Task-Tier Precision:** Explicitly scope local routing to narrow/routine tasks (linter bumps, boilerplate, single-file edits, email/scheduling). Code review and multi-file analysis are NOT local-suitable.

### Slash Command / UX Additions

21. **`/metis:why`:** Surface 4-criteria routing decision (scope, harness-fit, cost/latency, context health), provider Q-value for this task_type, and confidence score. Not just "routed to Ollama" but the full reasoning chain.
22. **`/metis:status` (5 dimensions):** Runtime health, routing decisions (active dialect + auto/manual mode), memory health (index staleness vs. git HEAD), economic telemetry (cumulative savings + TTFT/TPS), learning progress (probe count + Q-values + recent T2/T3). Compact default; `--detail` verbose.
23. **`/metis:forget`:** 4-tier deletion preview (Working/Episodic/Semantic/Procedural), blast-radius dependency warning, governance audit trail entry, git snapshot before execution, confirmation required for semantic/procedural tier.
24. **`/metis:do --provider=claude`:** Explicit routing bypass for a single task. Documents the "normal mode" off-ramp without requiring config edits.
25. **Off-ramp hints:** Surface confidence degradation warning when multiple findings in a session fall into speculative range. Context anxiety meter at 80% context capacity. Session handoff suggestion with `--fresh-session`.

### Architecture Decisions

26. **Memory Architecture:** Adopt agentmemory MCP for `world_facts` and `entity_summaries` (BM25+vector+graph retrieval, lifecycle hooks, 1,900-token budget, OTEL). Build custom SQLite tables for routing state and bandit data (bandit arms, Q-values, T2/T3 signals, failure_class, signal_class). This halves implementation surface without giving up routing sovereignty.
27. **Complementary Integration (Advisory):** Recommend GitNexus MCP as a complementary integration for structural code analysis (AST blast radius, process flows). Plan-gate Critic agent should have access to both agentmemory (what happened) and GitNexus (what is affected).

### Deferred (Commission before architecture review)

28. **M-5 (Circuit-breaker auto-disable):** Not retrieved — commission a follow-up NLM query on auto-disable thresholds and graceful degradation patterns.
29. **M-7 (Team memory threshold):** Not retrieved — commission follow-up on per-user vs. shared team memory transition patterns.
30. **M-10 (npm install adoption evidence):** Not retrieved — commission follow-up on distribution friction data.
