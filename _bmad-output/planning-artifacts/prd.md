# Metis v1 — Product Requirements

**Author:** Somyung  
**Date:** 2026-05-17  
**Status:** Active — lean scope

> The v2 reference docs (`prd-v2-reference.md`, `architecture-v2-reference.md`) contain the full Thompson Sampling / four-network / Critic design. File them under reference. Do not reopen until v1 has been used for two weeks and real usage data justifies what to build next.

---

## What Metis Is (v1)

A Claude Code plugin that delegates a coding task to Codex or Copilot CLI, remembers what happened, and uses that memory to inform the next delegation.

**One command: `/metis:do`**

That is the entire scope. Routing is automatic but deliberately simple. Memory is one SQLite file per repo. No bandit, no four-network architecture, no Critic sub-agent. Those become candidate v2 features after real usage data justifies them.

**Target user:** Solo developer (Somyung) who uses Claude Code and wants to offload tasks to Codex or Copilot without re-explaining codebase context every time.

---

## The One Success Metric

> After delegating a task, did the user have to re-explain context or correct the result?

If yes — that delegation cost work. If no — memory-informed delegation paid for itself.

**How it's measured in v1:**
- `/metis:tag good` or `/metis:tag bad` after each delegation (manual)
- `/metis:status` shows the last 10 delegations with tags and the weekly good-ratio
- Track weekly: tagged good ratio should trend up as memory accumulates
- Also log: total delegations per week (is the tool being used?) and time between delegation and next user message (passive signal, not acted on in v1)

**Why manual tagging:** Automatic attribution (git commits, reverts, follow-up edits) requires a 2-week observation window and real labeled data to calibrate against. v1 generates that data. v2 uses it.

---

## Plugin Structure

Directly follows the `openai/codex-plugin-cc` pattern (Apache 2.0).

```
metis/
  .claude-plugin/
    plugin.json
  commands/
    do.md              ← /metis:do
    tag.md             ← /metis:tag good|bad
    status.md          ← /metis:status
  agents/
    metis-claude.md    ← Claude subagent definition (Phase 4; instruction-layer delegate)
                       ← (Phase 1's metis-codex.md / metis-copilot.md were dropped: codex/copilot
                       ←  are subprocess adapters under scripts/lib/providers/, not subagents.)
  scripts/
    metis.mjs          ← main entry (router + memory)
    lib/
      memory.mjs       ← SQLite read/write + findSimilar (FTS5 recall)
      retrieval.mjs    ← prompt-template builder + token budget (Phase 2a)
      router.mjs       ← provider selection
      providers/
        codex.mjs
        copilot.mjs
```

**Format:** `.mjs` — Node.js native, no build step, no TypeScript, consistent with the Codex plugin pattern.

**Distribution:** `npm install -g metis` (primary). `claude plugin install metis` (marketplace, when published). `git clone + install.sh` (dev path).

---

## What Gets Stored (Schema)

One SQLite database per repo at `.metis/metis.db` using `better-sqlite3`. One table.

```sql
CREATE TABLE delegations (
  id               INTEGER PRIMARY KEY,
  ts               INTEGER NOT NULL,        -- unix timestamp
  task             TEXT    NOT NULL,        -- raw user request
  task_type        TEXT,                    -- 'review'|'fix'|'feature'|'refactor'|'explain'
  provider         TEXT    NOT NULL,        -- 'codex'|'copilot'|'claude'
  context_injected TEXT,                    -- past delegations shown to provider (byte-for-byte)
  result           TEXT,                    -- provider output (truncated to ~4KB)
  tag              TEXT,                    -- 'good'|'bad'|NULL (untagged)
  followup_messages TEXT,                   -- next 1-3 user messages (passive, for v2 analysis)
  embedding        BLOB                     -- NULL in v1; populated by v1.1+ when sqlite-vec lands
);

CREATE VIRTUAL TABLE delegations_fts
  USING fts5(
    task,
    content='delegations',
    content_rowid='id',
    tokenize='porter'
  );
```

> **External-content FTS5 is not self-populating — sync triggers are MANDATORY, not optional.** `delegations_fts` uses `content='delegations'`, so it indexes nothing until INSERT/UPDATE-of-`task`/DELETE triggers mirror rows into it (plus a one-time `rebuild` to backfill). Without them this index is permanently empty and all retrieval silently returns nothing. The triggers ship in `scripts/lib/migrations/002_fts_sync.sql` (see Build Order → Phase 1.1). The original schema omitted them — that omission is the defect Phase 1.1 closes.

No bandit arms table. No four networks. No Q-values. No failure_class taxonomy. Add columns when reality demands them, not before.

**Why SQLite over flat JSON:** FTS5 gives keyword search for "find similar past tasks" — which is exactly what retrieval needs. Atomic writes prevent corruption. One dependency: `better-sqlite3`.

---

## What Gets Retrieved (Recall)

Before `/metis:do` calls the provider, run one FTS5 query: find the 3 most similar past delegations to the current task. Inject them into the provider's prompt as "previous related work on this codebase" with their outcomes (tagged good/bad).

**Token budget:** Best-effort cap at ~1,500 tokens of injected context (see Implementation Notes for the mechanism's limit).
- 3 past delegations over budget → take 2
- 2 over budget → take 1
- 1 over budget → truncate to 1,500 tokens
- No past delegations → inject nothing, provider runs as it would today

No allocator, no priority order, no compaction logic in v1.

---

## Routing Rule (Deliberately Dumb)

> If the current task's nearest tagged-good past delegation was handled by provider X, use X. Otherwise default to Codex.

That is the entire routing logic. No bandit, no Thompson Sampling, no Q-values.

**Why:** If this dumb rule beats random across 50 delegations, the routing concept is validated and we build something smarter in v2. If it doesn't, the routing chapter of the v2 architecture doc was solving a problem that doesn't exist.

---

## Explicitly Out of Scope for v1

| Feature | Why deferred |
|---|---|
| Thompson Sampling / bandit | Can't be validated in 8 weeks at 5 delegations/day. Needs prior usage data. |
| Four-network memory (Hindsight) | One table works at v1 scale. Add networks when retrieval fails on real queries. |
| MemRL Q-value scoring | No data to train against until v1 ships. |
| Ollama support | Two providers prove multi-provider works. Third is v1.5. |
| Critic sub-agent | Personal tool, one user. Credential scanning is not a v1 risk. |
| T2/T3 git attribution | Requires 2-week observation window. v2 feature when tagged data exists to calibrate. |
| evolving_beliefs network | v2 architecture doc flagged this as "most deferrable v1 network." |
| Workspace / global memory layers | One repo, one db. Cross-repo patterns emerge from usage; design then. |
| JSONC config / Zod / migration runner | v1 has no config. Add when reality demands it. |
| Plan-confirmation workflow | Trust the provider for v1. Add review gate when bad outputs actually show up. |
| `/metis:why`, `/metis:forget`, `/metis:help` | Nice-to-have. Add after core loop is proven. |

---

## Relationship to v2 Designs

v1 is not abandoning MemRL + Hindsight. v1 is building the minimum viable instance of the same loop so v2 has real data to apply those concepts to.

| Concept | v1 | v2 (when data justifies it) |
|---|---|---|
| retain() | INSERT row | Structured write to four networks |
| recall() | FTS5 keyword query | Semantic similarity + Q-value rerank |
| reflect() | (none) | LLM synthesis across entity summaries |
| Outcome signal | `tag` column ('good'/'bad'/NULL) | failure_class + signal_class + t3_confidence |
| Routing | Last-good-provider rule | Thompson Sampling with calibrated priors |
| Storage | 1 table | 4 networks in same SQLite DB |

The migration path is real, not a rewrite. PRAGMA user_version + numbered migration files means evolving from v1's single table to v2's four networks is a controlled migration.

---

## Build Order

Three phases. Each phase has a goal, dependencies, success criteria (verification gate), and concrete tasks. Stop after each phase and use the tool on real work before starting the next phase.

> **Verification rule:** A phase is not complete until every success criterion can be demonstrated. "It compiles" is not verification. "I ran it and observed X" is verification.

---

### Phase 1: Plugin Scaffold + Basic Delegation

**Goal:** A working Claude Code plugin that delegates a task to Codex and records the outcome to SQLite.

**Dependencies:** None. Greenfield.

**Success Criteria (verification gate):**
1. Plugin installs into Claude Code via local symlink or `claude plugin install ./metis`
2. `/metis:do "fix the typo in README.md"` invokes Codex CLI as a subprocess and returns its output into the Claude Code conversation
3. After the delegation completes, a row exists in `.metis/metis.db` with task, provider='codex', result, and timestamp populated
4. `.metis/.gitignore` is auto-created with `*` and `!.gitignore` contents on first run
5. `/metis:tag good` and `/metis:tag bad` update the `tag` column of the most recent delegation row
6. Running `/metis:do` with no `.metis/` directory creates it fresh; running again in the same repo reuses the existing db
7. The migration runner sets `user_version = 1` after creating the schema; rerunning does NOT re-execute `001_init.sql`

**Tasks:**
- [ ] `plugin.json` with metadata + command/agent declarations
- [ ] `commands/do.md` — invokes `scripts/metis.mjs do <task>`
- [ ] `commands/tag.md` — invokes `scripts/metis.mjs tag <good|bad>`
- [x] ~~`agents/metis-codex.md` — agent profile for Codex delegation~~ — **dropped (2026-05-18):** delegation is script-driven via the ProviderAdapter (`scripts/lib/providers/codex.mjs`); a Claude subagent has no functional role in v1.
- [ ] `scripts/metis.mjs` — entry point (CLI arg dispatch)
- [ ] `scripts/lib/memory.mjs` — open db, run migrations, insert/update rows, set WAL + busy_timeout + foreign_keys pragmas, register exit handler
- [ ] `scripts/lib/migrations/001_init.sql` — schema from §"What Gets Stored" + `PRAGMA user_version = 1`
- [ ] `scripts/lib/providers/codex.mjs` — `child_process.spawn` adapter with `{ signal }`
- [ ] `.metis/.gitignore` auto-creation on first run
- [ ] `task_type` keyword classifier function in `metis.mjs`

**Usage period:** 3–5 days. Run real delegations on actual code. Tag each one good or bad.

---

### Phase 1.1: FTS Index Population (Phase 1 spec-defect closure)

> **Why this exists (2026-05-19):** The Phase 1 schema (§"What Gets Stored") declared an external-content FTS5 table but omitted the sync triggers that pattern *requires*, so the index was never populated. Not in the original phase plan — discovered during Phase 2 planning (Phase 2 is the first phase that reads the index). This closes that defect before Phase 2 builds on it.

**Goal:** `delegations_fts` actually stays in sync with `delegations` and is backfilled from rows recorded before the fix. Scope is ONLY this — nothing reads the index yet (stays Phase 2).

**Dependencies:** Phase 1 merged. Real per-repo dbs at `user_version = 1`.

**Success Criteria (verification gate — via the real `openDb()`/`migrate()` path on a COPY of a real db; assert with `MATCH`, never `count(*)`):**
1. Backfill: `MATCH` on a token literally present in a pre-migration `task` returns that existing row (`bm25()` JOIN form)
2. INSERT trigger: a newly inserted row is found by `MATCH` on a token from its task
3. UPDATE-of-`task` trigger (update `task` directly — no app helper does): old token → 0 rows, new token → 1 row
4. DELETE trigger: deleted row's token → 0 rows
5. Non-`task` update (`updateResult()`/`tagLatest()`) does NOT corrupt the index — a token from the unchanged task still matches
6. Parity: a backfilled row and a post-migration trigger-inserted row are both returned by `MATCH` on a shared token
7. `user_version = 2`; a second `openDb()` does not re-run `002` (idempotent, no error)
8. Atomicity: a forced mid-migration failure on a copy rolls back fully (`user_version` still 1, no triggers left)

**Tasks:**
- [ ] `scripts/lib/migrations/002_fts_sync.sql` — transaction-wrapped: `ai`/`ad` triggers, `au` as `AFTER UPDATE OF task`, one-time `rebuild` backfill, `PRAGMA user_version = 2`
- [ ] PRD: this section + the mandatory-triggers callout by the schema + name `002` in the migration-runner notes
- [ ] No changes to `memory.mjs`/`metis.mjs` (the existing directory-driven, version-gated runner auto-applies `002`)

**Out of scope:** `findSimilar`, prompt template, token budget, `/metis:status`, `retrieval.mjs`, `followup_messages`, routing/Copilot — all Phase 2/3. Runner-level per-migration transaction wrapping is a separate future hardening, deliberately not done here.

---

### Phase 2: Memory Retrieval + Observability

**Goal:** Past delegations inform new ones via FTS5 retrieval; `/metis:status` shows trends.

**Dependencies:** Phase 1 complete and verified. At least ~10 real delegations recorded.

**Success Criteria (verification gate):**
1. Before calling Codex, `/metis:do` runs the FTS5 query and retrieves up to 3 past delegations matching the current task
2. The exact prompt template from §"Prompt template" is built and stored in `context_injected` byte-for-byte
3. Token budget cap (~1500 tokens) is enforced: if 3 past results exceed budget, fewer are used; result chars truncated to 500 each
4. When zero FTS5 matches exist, no `<past_work>` block is sent; only the raw task goes to Codex
5. `/metis:status` outputs the last 10 delegations with tag markers and a 7-day rolling good-ratio percentage
6. After 10 real tagged delegations, the `/metis:status` good-ratio number matches a manual count (sanity check)
7. **(Best-effort)** `followup_messages` column is populated when capture mechanism is available; if not, column stays NULL and is backfilled in v1.x when a path is found. **See Implementation Notes for mechanism caveat.** Not a hard verification gate.

**Tasks:**
- [ ] `scripts/lib/memory.mjs` — add `findSimilar(taskText, limit=3)` using FTS5 MATCH + BM25 ORDER BY
- [ ] FTS5 query input sanitization (escape special chars before MATCH)
- [ ] Prompt template builder — produces exact string from §"Prompt template"
- [ ] Token budget enforcement — `Math.ceil(text.length / 4)` estimation, drop entries when over budget
- [ ] Result truncation — first 500 chars + ellipsis if longer
- [ ] `commands/status.md` + `scripts/metis.mjs status` handler
- [ ] `/metis:status` output format from §"What `/metis:status` outputs"
- [ ] **(Mechanism TBD)** Capture follow-up messages — investigate whether Claude Code's plugin API exposes a post-message hook a `.md` command file can subscribe to. If yes, record next 1–3 user messages. If no clean API exists, leave `followup_messages` NULL for v1 and document the gap. Do NOT block v1 on this. Do NOT fake the data.

**Usage period:** 1 week of real delegations with memory active.

---

### Phase 3: Second Provider + Routing

**Goal:** Copilot CLI joins as a second provider; the routing rule picks between Codex and Copilot based on the nearest tagged-good past delegation.

**Dependencies:** Phase 2 complete and verified. At least ~30 total real delegations recorded across phases 1–2.

**Success Criteria (verification gate):**
1. `/metis:do` correctly picks `'codex'` or `'copilot'` based on the nearest tagged-good past delegation in FTS5 results
2. When no tagged-good match exists, Codex is the default (verified by checking the routing function's fallback branch)
3. Both `providers/codex.mjs` and `providers/copilot.mjs` conform to the `ProviderAdapter` interface (`name`, `delegate({ prompt, signal })`)
4. AbortSignal cancellation works: sending Ctrl-C during a `/metis:do` in flight kills the provider subprocess cleanly (no orphaned processes)
5. After 50+ delegations across both providers, `/metis:status` shows a provider distribution that is not 100% one or the other (some routing happened)
6. The routing decision is observable: each row in `delegations` table shows which provider was actually used, allowing post-hoc routing analysis

**Tasks:**
- [ ] `scripts/lib/providers/copilot.mjs` — `child_process.spawn` adapter for `copilot` (install: `npm install -g @github/copilot`; verified non-interactive invocation: `copilot -p <prompt> --silent --allow-all-tools`)
- [ ] `agents/metis-copilot.md` — agent profile for Copilot delegation
- [ ] `scripts/lib/router.mjs` — `pickProvider(currentTask, retrievedPastDelegations)` function from §"Routing rule"
- [ ] `ProviderAdapter` interface enforcement — both adapters typed identically
- [ ] AbortSignal wiring — `/metis:do` accepts cancellation; subprocess receives `{ signal }`; cleanup on cancel

**Usage period:** 2 weeks of real delegations with routing active.

---

### Phase 4: Claude Provider (Subagent-Based)

> **Why this exists (2026-05-22):** Phase 3 added Copilot as a second provider, but Codex and Copilot are both OpenAI-family subprocesses — they don't differentiate enough to test the routing thesis. The "fresh perspective from a different model" claim is only cleanly tested when Claude is a provider, and Claude is the highest-affinity provider (zero install friction, already authenticated). A retrospective concluded Claude should have been in v1's original scope; this phase corrects that. Added after Phase 3 was verified and merged.

**Goal:** Claude joins as a third provider, delegated to via Claude Code's native Agent tool (not a subprocess). Routing rule treats `'claude'` identically to `'codex'`/`'copilot'`.

**Dependencies:** Phase 3 complete and verified.

**Architectural shift:** Claude is the first provider that does NOT conform to the subprocess `ProviderAdapter` interface. Delegation happens at the **command instruction layer** (in `do.md` via the Agent tool), not at the script layer. The script splits its existing `runDo` flow into three subcommands: `prepare` (classify + retrieve + INSERT row, output JSON), `delegate` (subprocess path for codex/copilot), `record` (UPDATE result, used by the subagent path). See §"Provider integration → Claude provider — interface exception".

**Success Criteria (verification gate):**
1. `agents/metis-claude.md` is recognized as a custom subagent (`name: metis-claude` in frontmatter; `tools: Read, Edit, Write, Bash, Grep, Glob`). Plugin runtime registers it as `metis:metis-claude` (`<plugin-name>:<agent-name>`); the Agent call in `do.md` MUST use that namespaced form.
2. `/metis:do "<task>" --provider claude` forces Claude delegation; the subagent runs with fresh context (no Metis session transcript visible)
3. Auto-routing: when the nearest tagged-good past delegation used Claude, `/metis:do "<task>"` (no flag) picks Claude
4. After delegation, the row exists in `.metis/metis.db` with `provider='claude'` and `result` populated
5. `/metis:do "<task>" --provider codex` and `--provider copilot` still work identically to Phase 3 (no regression)
6. `/metis:tag good` and `/metis:tag bad` correctly tag the latest Claude delegation
7. `/metis:status` includes Claude rows in the rolling summary
8. AbortSignal contract preserved: if the subagent fails or is interrupted, the row stays with NULL `result` (no partial state)

**Tasks:**
- [ ] `agents/metis-claude.md` — subagent definition (frontmatter: name, description, tools; body: fresh-context delegate role)
- [ ] `scripts/metis.mjs` — add `prepare` / `delegate` / `record` subcommands; remove the old monolithic `do` subcommand (only `do.md` called it)
- [ ] `commands/do.md` — rewrite for split flow (add `Agent` to allowed-tools, conditional branch on provider; keep `disable-model-invocation: true` — the flag prevents auto-invocation but does not block in-command tool use)
- [ ] `scripts/lib/router.mjs` — add `'claude'` to `KNOWN_PROVIDERS`

**Out of scope:** No `scripts/lib/providers/claude.mjs` (Claude is not a subprocess adapter). No schema migration (the `provider` column already accepts any TEXT; the enum comment is a documentation update only). No task-type-aware subagent selection (`general-purpose` vs `code-architect` etc. is a v1.x follow-up).

**Usage period:** 1 week of real delegations with all three providers active, observe whether auto-routing picks Claude.

**Billing note:** The Agent tool spawned from inside `/metis:do` is **interactive use** — it stays on the ambient Claude Code subscription, not the Agent SDK credit pool. See §"Provider integration → Billing" for the June 15, 2026 split.

---

### Decision Point (Week 4–5)

**Not a phase.** A review checkpoint before any further work.

**Goal:** Look at the data and decide what (if anything) from the v2 reference docs to build next.

**Inputs:**
- Output of `/metis:status` over the full usage period
- Manual review of `delegations` table rows
- Subjective sense of "did Metis make me more productive?"

**Decision criteria (any one triggers further work):**
- Tagged good-ratio trending up week-over-week → memory injection is helping → build more sophisticated memory (sqlite-vec, four-network, etc.)
- Routing rule beats random by ≥5% on tagged-good outcomes → routing concept validated → consider Thompson Sampling
- Both providers show identical performance on this codebase → routing isn't the point → focus on memory quality
- Tagged good-ratio flat or trending down → memory is hurting or irrelevant → re-examine retrieval before adding anything

**No-go criteria (any one triggers stop):**
- `/metis:do` used <5 times per week → tool isn't earning its place → shelve project
- Manual tagging fatigue led to <50% tag rate → measurement broke → fix measurement before adding features
- Cancellation/orphan bugs surfaced in real use → stabilize v1 before extending

---

## Risks

**Manual tagging fatigue.** The user will forget to tag.  
Mitigation: if a passive capture mechanism is available, log raw follow-up messages (`followup_messages` column) so v2 can do automatic classification on real data. **Note: the mechanism for passive capture is TBD — see Implementation Notes. If unavailable, the column stays NULL in v1 and v2's automatic outcome detection becomes a real architectural problem to solve, not a config switch.**

**Two providers may not differentiate.** Codex and Copilot are similar enough that routing between them might not show signal.  
Mitigation: that's a finding worth knowing. If both behave identically, routing isn't the point and memory injection is. That still validates the core thesis.

**FTS5 may retrieve unhelpful results.** Keyword matching may surface past delegations that are textually similar but contextually irrelevant.  
Mitigation: real data tells us if this is a problem. If yes, that's when `sqlite-vec` embeddings become a real priority — not before.

**4 weeks of dogfooding is the whole project.** Either it's obviously useful or obviously not by then. That clarity is the goal.

---

## Implementation Notes

Detailed decisions for the agent implementing this PRD. Each section answers a specific question that the body of the PRD glosses over.

### task_type classification

A pattern-matched keyword classifier in `metis.mjs`. Local, deterministic, runs in microseconds. No LLM call.

```js
function classifyTaskType(task) {
  const t = task.toLowerCase();
  if (/\b(fix|bug|broken|error|crash|fails?|failing)\b/.test(t)) return 'fix';
  if (/\b(review|check|audit|inspect)\b/.test(t)) return 'review';
  if (/\b(refactor|clean ?up|simplify|restructure)\b/.test(t)) return 'refactor';
  if (/\b(explain|what does|how does|why does|describe)\b/.test(t)) return 'explain';
  return 'feature';
}
```

**Stored but not used for filtering retrieval in v1.** The classifier output goes into `task_type` for future analysis and v2 routing rules. v1 retrieval is FTS5 score only.

**Migration path:** when the keyword classifier produces obvious wrongness in real use (e.g., "review the bug fix" buckets incorrectly), replace with an LLM call. The schema doesn't change — only the function body.

### FTS5 retrieval query

Query against `task` column only. Porter tokenizer. Default BM25 scoring.

```sql
SELECT d.*
FROM delegations d
JOIN delegations_fts f ON d.id = f.rowid
WHERE delegations_fts MATCH ?
ORDER BY bm25(delegations_fts) ASC
LIMIT 3;
```

The MATCH parameter is the current task text, sanitized for FTS5 syntax (escape double quotes, strip special chars `^`, `*`, `:`, parentheses unless intentional).

**No task_type partitioning in v1.** All past delegations are eligible regardless of type. If FTS5 returns garbage matches in real use, that's the signal to add semantic similarity (sqlite-vec) — not to add task_type filtering first.

**If FTS5 returns zero results:** inject nothing. Provider runs without memory context. This is correct behavior, not an error.

### Prompt template (the exact string)

The injection template wraps past delegations in an XML-style block. This exact string is what gets stored in `context_injected` byte-for-byte AND prepended to the user's task before calling the provider.

```
<past_work>
The following past delegations on this codebase are provided as reference. They are not part of the current task.

Tagged outcomes:
- ✓ Past work that helped: use these patterns
- ✗ Past work that did not help: avoid repeating these mistakes
- Untagged: no judgment available, treat as neutral context

[1] {tag_marker} ({provider})
Task: {task}
Result: {truncated_result}

[2] {tag_marker} ({provider})
Task: {task}
Result: {truncated_result}

[3] {tag_marker} ({provider})
Task: {task}
Result: {truncated_result}
</past_work>

Current task: {user_task}
```

**`tag_marker` values:**
- `tag = 'good'` → `✓ helped`
- `tag = 'bad'` → `✗ did not help`
- `tag IS NULL` → `~ untagged`

**`truncated_result`:** First 500 characters of `result`, raw. No smart extraction in v1. If `result` is shorter than 500 chars, use the whole thing. Append `…` (single ellipsis char) if truncated.

**Token budget:** Best-effort cap at ~1500 tokens total for the `<past_work>` block. If 3 past delegations would exceed this, take 2. If 2 exceed, take 1. If even 1 entry exceeds 1500 tokens after 500-char truncation (extremely unlikely), truncate that single entry's result further. Token estimation: `Math.ceil(text.length / 4)`. **Limit of the mechanism (2026-05-21):** truncation shrinks `result` only, not `task` — a pathological past `task` length can exceed the cap even at K=1 with `result` shrunk to empty. The produced block is well-formed but over budget; the "cap" is best-effort, not hard.

**No past delegations match:** the entire `<past_work>...</past_work>` block is omitted and `context_injected` is NULL. The **raw task is sent unchanged** — no `<past_work>`, and no `Current task:` prefix either. (Phase 2 gate 4 — "only the raw task goes to Codex" — is authoritative over the looser "`Current task: {user_task}` is sent" wording above; this preserves exact Phase 1 behavior when there is no memory to inject. Resolved 2026-05-19, Phase 2a.)

### Provider integration

Both providers use `child_process.spawn` with `{ signal }` for cancellation support (Node 15.4+ feature). Same shape, different binary.

```js
// scripts/lib/providers/codex.mjs
import { spawn } from 'node:child_process';

export async function delegate({ prompt, signal }) {
  return new Promise((resolve, reject) => {
    const proc = spawn('codex', ['exec', prompt], { signal });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d) => { stdout += d.toString(); });
    proc.stderr.on('data', (d) => { stderr += d.toString(); });
    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code !== 0) reject(new Error(`codex exited ${code}: ${stderr}`));
      else resolve(stdout);
    });
  });
}
```

Copilot adapter follows the identical shape using `copilot -p <prompt> --silent --allow-all-tools` (install: `npm install -g @github/copilot`). `gh copilot suggest` was deprecated October 2025 and is not the correct entrypoint.

**Copilot invocation is LOCKED (2026-05-22):** `copilot -p "<prompt>" --silent --allow-all-tools`. `-p` is the non-interactive flag; `--silent` strips UI metadata; `--allow-all-tools` enables automatic tool execution without interactive confirmation. Auth via ambient `gh auth login` or `GH_TOKEN` env var. Spawn with `stdio: ['ignore', 'pipe', 'pipe']` as a precaution against pipe-hang (same pattern as codex.mjs).

**v1 Codex invocation is LOCKED (2026-05-18):** `codex exec "<prompt>" --sandbox workspace-write`. The `--sandbox workspace-write` flag is required — `codex exec` defaults to a read-only sandbox, which would block code-editing delegations (e.g., the "fix the typo" example). The `codex.mjs` adapter must add `'--sandbox', 'workspace-write'` to the args array; do not copy the read-only snippet above verbatim. stdout = final agent message (the result); stderr = progress stream. **The adapter must also spawn with `stdio: ['ignore', 'pipe', 'pipe']`** — when stdin is a non-TTY pipe, `codex exec` tries to read it as a `<stdin>` block and blocks forever on an unclosed pipe ("Reading additional input from stdin..."); the snippet above omits `stdio` and would hang under Node's default piped stdin (verified 2026-05-18).

**Delegation auth/billing is the user's ambient `codex` setup — Metis manages neither.** The adapter just spawns `codex exec` and inherits whatever auth `codex login` / `CODEX_API_KEY` provides. API-key auth is OpenAI-recommended for this automation use-case and is billed separately (usage-based) from any ChatGPT subscription — analogous to `claude -p`. See §"Billing" below for the Claude-side billing model (the Phase 4 Claude provider uses the Agent-tool path, which stays on the user's interactive Claude Code subscription).

**ProviderAdapter interface (required for both):**
```ts
type ProviderAdapter = {
  name: 'codex' | 'copilot';
  delegate: (args: { prompt: string; signal: AbortSignal }) => Promise<string>;
};
```

`signal` is required, not optional. Cancellation cannot be bolted on later.

**AbortSignal source:** Node's `spawn({ signal })` is the correct mechanism. How Claude Code propagates a cancellation event from the user (Ctrl-C, plugin lifecycle, session end) into the `signal` parameter of the plugin's `delegate()` call needs confirming against Claude Code's plugin runtime API at implementation time. If Claude Code does not pass an AbortSignal through the plugin invocation, fall back to constructing one inside `metis.mjs` keyed to process-level SIGINT — but document this choice in the README.

### What the AbortSignal concern actually is

This is the one thing worth addressing. The question: what's in `metis.db` if the subprocess is aborted mid-delegation?

Honest answer that fits in the PRD, not a new document — the delegation write is ordered so abort is always safe:

- **Pre-delegation:** a row is INSERTED with `task`, `provider`, `context_injected`, `ts`. `result` is NULL.
- **During delegation:** the streamed result is held in memory, not written to the db yet.
- **On abort:** the db row stays as-is (NULL `result`). No partial result is written. `tag` stays NULL.
- The user can see the aborted row in `/metis:status` as "no result" and decide to retry or delete.

### Claude provider — interface exception (Phase 4)

Phase 4 adds Claude as a third provider, but **Claude does NOT conform to the `ProviderAdapter` interface above**. Codex and Copilot are subprocess adapters (`spawn` + `{ signal }`); Claude is delegated to via Claude Code's native **Agent tool**, which is only callable from the command instruction layer (markdown command files), not from Node.js.

The `PROVIDERS` registry in `scripts/metis.mjs` therefore contains subprocess adapters only — `'claude'` is a recognized provider name (for routing) but has no entry in `PROVIDERS`. Delegation for Claude happens in `commands/do.md`:

```
1. Generate a unique task tmp directory with `mktemp -d`, then write the task to a new file inside it via the Write tool (verbatim, no escaping)
2. Run `node metis.mjs prepare --from-file <task-file> [--provider <name>]`
   → outputs JSON { rowId, provider, prompt }; row is INSERTed with NULL result;
     the script unlinks the tmp file after reading
3. Branch on provider:
   - 'claude': spawn subagent via Agent tool (subagent_type: metis:metis-claude) with the prompt
               → generate a unique result tmp directory with `mktemp -d`, then write the result to a new file inside it via Write
               → run `metis.mjs record <rowId> --from-file <result-file>`
               → if record fails: report the error and still relay the result to the user
   - else:     run `metis.mjs delegate <rowId>` (subprocess via existing adapter)
4. Relay result to user
```

**Shell-safety contract:** untrusted payloads (the user's task and the Claude subagent's result) MUST NOT be interpolated into shell command lines — double-quoted shell args still expand `$()`, backticks, and `$VAR`. The Write tool takes file contents as a JSON parameter (not shell), so do.md uses `mktemp -d` to generate per-invocation tmp directories, uses Write to create new payload files inside those directories, then references only those generated paths on shell command lines. No untrusted payload content touches the shell. Provider names stay positional in the shell command because they are a bounded enum (`codex`/`copilot`/`claude`). The `--from-file` flag on `prepare` and `record` is the safe entry point; positional payload args are still supported for direct-CLI use but should not be used by do.md.

**`do.md` constraint changes:**
- `disable-model-invocation: true` is **preserved** — the flag prevents Claude from auto-invoking `/metis:do` based on ambient context (the original safety guarantee). It does NOT block in-command model reasoning or tool use when the user has explicitly invoked the command; `allowed-tools` controls that.
- `allowed-tools` expands from `Bash(node *)` to `Bash(node *), Bash(mktemp *), Agent, Write` (`mktemp -d` creates unique handoff directories, Write creates payload files, and Agent spawns the subagent)

**AbortSignal contract preserved:** if the Agent tool fails or is interrupted before `record` runs, the row stays with NULL `result` — same failure semantics as a subprocess abort.

**Why this asymmetry is correct:** the subprocess interface is the right abstraction for external CLIs (codex, copilot) where the script controls the lifecycle. Claude lives inside the same process tree as the host Claude Code session; coercing it through a subprocess wrapper would either require `claude -p` (wrong billing model — see §"Billing") or building an artificial IPC mechanism. The instruction-layer dispatch is the natural fit, and matches the established pattern for Claude Code plugins that spawn subagents (e.g. GSD).

**Subagent definition (`agents/metis-claude.md`):**
- `name: metis-claude` in frontmatter; Claude Code's plugin runtime registers it as `metis:metis-claude` (the `<plugin-name>:<agent-name>` namespacing applied to all plugin-defined agents). The Agent call in `do.md` MUST use the namespaced form `subagent_type: "metis:metis-claude"`; the bare `metis-claude` does not match.
- `tools: Read, Edit, Write, Bash, Grep, Glob` — full coding tool surface, equivalent to what `codex exec --sandbox workspace-write` grants
- Body: short role description framing the subagent as a fresh-context delegate for a coding task. The full task prompt (including any injected `<past_work>` block) is passed to the Agent call's `prompt` argument; the agent file is the system prompt only.

### Billing

Anthropic split programmatic Claude usage from interactive use as of **June 15, 2026**:

- **Programmatic (`claude -p`, `@anthropic-ai/agent-sdk`):** draws from a separate Agent SDK credit pool. Monthly credits: Pro $20, Max 5x $100, Max 20x $200, Team Standard $20, Team Premium $100, Enterprise $20–$200.
- **Interactive (Claude Code session, including Agent tool spawned from within a command):** stays on the ambient Claude Code subscription.

Metis's Phase 4 Claude provider uses the Agent tool from inside `/metis:do` — this is **interactive use**, so it stays on the ambient subscription. Any future design that shells to `claude -p` instead would consume the user's separate Agent SDK credit pool, which is the wrong billing model for a delegation tool that runs frequently. The Agent-tool path avoids this entirely.

For Codex and Copilot, the user's ambient CLI auth is used (`codex login` / `CODEX_API_KEY`; `gh auth login` / `GH_TOKEN`). Metis manages no provider auth.

### Routing rule (deliberately dumb)

```js
function pickProvider(currentTask, retrievedPastDelegations) {
  // Find the nearest past delegation that was tagged 'good'
  const nearestGood = retrievedPastDelegations.find(d => d.tag === 'good');
  if (nearestGood) return nearestGood.provider;

  // Fallback: default to Codex
  return 'codex';
}
```

That is the entire routing logic. No bandit, no Thompson Sampling, no Q-values.

### Migration runner

Use `better-sqlite3` + `PRAGMA user_version` + numbered SQL files. This is the v1.x → v2 upgrade path; getting it right in v1 makes future schema changes safe.

```
scripts/lib/migrations/
  001_init.sql      <- creates delegations + delegations_fts + sets user_version=1
  002_fts_sync.sql  <- external-content FTS5 sync triggers + one-time rebuild backfill; sets user_version=2 (Phase 1.1)
  (future versions added here as 003_*.sql, ...)
```

Migration runner on plugin load:
```js
function migrate(db) {
  const current = db.pragma('user_version', { simple: true });
  const files = fs.readdirSync(MIGRATIONS_DIR).sort();
  for (const f of files) {
    const version = parseInt(f.split('_')[0], 10);
    if (version > current) {
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, f), 'utf8');
      db.exec(sql);  // each migration must include "PRAGMA user_version = N" as last statement
    }
  }
}
```

Atomicity is per-file and the file owns it: the runner calls `db.exec(sql)` with no transaction or error handling of its own, so a migration that must be all-or-nothing wraps its body in `BEGIN; … COMMIT;` (see `002_fts_sync.sql`). On a mid-file failure nothing is committed; the open transaction is rolled back when the connection closes (the runner does not issue `ROLLBACK`), so `user_version` stays at the prior value and the next open retries cleanly. `001_init.sql` runs only against a fresh empty db, so it needs no wrapper.

### `.metis/.gitignore` (auto-created)

On first `/metis:do` invocation in a repo, if `.metis/` doesn't exist, create it AND write `.metis/.gitignore` with:

```
*
!.gitignore
```

This ignores everything inside `.metis/` (including `metis.db`) while keeping the `.gitignore` file itself tracked. Does NOT modify the repo's main `.gitignore` — keeps Metis non-intrusive.

When v1.1+ adds a shared `.metis/config.json` (for team-wide conventions), add `!config.json` to this file. Schema migration handles the rest.

### SQLite operational settings

On every db open in `memory.mjs`:

```js
const db = new Database(path.join(metisDir, 'metis.db'));
db.pragma('journal_mode = WAL');       // required for SIGKILL-safe persistence
db.pragma('busy_timeout = 3000');      // 3s wait on concurrent writes
db.pragma('foreign_keys = ON');        // future-proofing for v2 multi-table schema
process.on('exit', () => db.close());  // flush WAL on shutdown
```

### Logging passive signals

`followup_messages` column captures the next 1–3 user messages in the same Claude Code session after a `/metis:do` completes. This data feeds v2's automatic outcome detection (the 2-week git observation window referenced in the v2 docs).

**Mechanism is TBD.** Claude Code's plugin API may not currently expose a post-message hook that a `.md` command file can subscribe to. The implementer should investigate at Phase 2 time:

1. **If a passive hook exists** (post-message listener, session event API, etc.) — use it. Record the next 1–3 user messages raw. No parsing, no classification.
2. **If no clean API exists** — leave `followup_messages` NULL in v1. Document the gap in the README. Do NOT fake the data with explicit user prompts ("type your follow-up here") — that defeats the purpose of passive capture and is worse than no data.
3. **Backfill path:** column stays NULL in v1; when a mechanism becomes available (Claude Code API update, alternative capture method discovered), it can be populated going forward. Existing NULL rows are accepted as data loss.

If the session ends before 3 follow-up messages occur, store whatever was captured.

**This is the one item in the PRD with an unresolved mechanism.** Everything else has a clear implementation path. Do not let this block Phase 2 completion.

### What `/metis:status` outputs

A simple text rendering, not a fancy dashboard:

```
Last 10 delegations:
  [✓] 2026-05-17 14:23  fix (codex)    fix the login redirect bug
  [✗] 2026-05-17 13:01  refactor (copilot)  clean up the auth middleware
  [~] 2026-05-17 11:45  feature (codex)  add export to CSV button
  ...

Weekly summary (last 7 days):
  Total delegations: 23
  Tagged: 16 (good: 12, bad: 4)
  Good ratio: 75%
  Untagged: 7
```

The "good ratio" trending up over weeks is the success metric.

### Out-of-scope reminders for the implementer

The following appear in the v2 reference docs. **Do not build any of these in v1:**

- Thompson Sampling, bandit arms, Q-values, Beta distribution sampler
- Four memory networks (agent_experiences, entity_summaries, world_facts, evolving_beliefs)
- Critic sub-agent, credential scanning (FR-CRITIC-1)
- T2/T3 git attribution, failure_class taxonomy, signal_class decomposition, t3_confidence
- Workspace-layer or global-layer memory
- JSONC config, Zod schemas, plan-confirmation workflow
- PreCompact hook, reflect() operation, SessionStart hook
- Ollama support
- Plan generation phase before delegation

If a feature seems unclear or you find yourself reaching for one of these, stop and ask. The lean scope is intentional.
