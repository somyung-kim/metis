# Metis

> A Claude Code plugin that delegates a coding task to the Codex CLI, records what
> happened in a per-repo SQLite memory, and uses that memory to inform the next delegation.

**Status:** v1 · Phase 2b merged · in usage period before Phase 3 · Apache 2.0 · Node ≥20. A
personal tool in active verification — phases advance on real tagged-delegation data,
not version bumps.

---

## Install

1. **Clone + install dependencies.** `better-sqlite3` is a native module compiled
   against this machine's Node — must match Claude Code's Node ABI (`engines` pin: `>=20`).

   ```
   git clone https://github.com/somyung-kim/metis.git
   cd metis
   npm install
   ```

2. **Register with Claude Code** — either as a persistent plugin or for one session:

   ```
   claude plugin install /absolute/path/to/metis     # persistent
   claude --plugin-dir /absolute/path/to/metis        # dev / one-shot
   claude plugin validate .                           # sanity-check the manifest
   ```

3. **Install + authenticate the Codex CLI.** Metis spawns `codex exec` as a
   subprocess under your ambient credentials; it does not manage Codex auth or billing.

Verify the plugin loaded with `/metis:status` — with no delegations yet it should print an empty summary, not an error.

---

## Commands

All three commands have `disable-model-invocation: true` — Claude never invokes them autonomously, only when you type the slash command.

### `/metis:do "<task>"`

Delegate a coding task to Codex. Before invoking Codex, Metis runs an FTS5 query
against this repo's prior delegations and injects up to three of the most similar
past tasks (with their tagged outcomes) into the prompt as reference context.

```
/metis:do "add a /health endpoint returning the build SHA"
```

### `/metis:tag good|bad`

Tag the most recent delegation. The tag is v1's success signal — it answers "did you have to re-explain context or correct the result?"

```
/metis:tag good
/metis:tag bad
```

### `/metis:status`

Print the last 10 delegations and a rolling 7-day summary. Takes no arguments.

```
/metis:status
```

Example output:

```
Last 10 delegations:
  [✓] 2026-05-20 14:32  feature (codex)       add a /health endpoint returning the build SHA
  [✗] 2026-05-20 11:08  fix (codex)           fix the off-by-one in pagination
  [~] 2026-05-19 22:14  explain (codex)       what does scripts/lib/retrieval.mjs do
  [✓] 2026-05-19 17:51  refactor (codex)      split do.md command logic into helpers
  [✓] 2026-05-19 09:02  feature (codex)       wire up the weather provider to the dashboard

Weekly summary (last 7 days):
  Total delegations: 5
  Tagged: 4 (good: 3, bad: 1)
  Good ratio: 75%
  Untagged: 1
```

Markers: `✓` good · `✗` bad · `~` untagged.

---

## How it works

- **Per-repo memory.** On the first `/metis:do` in a repo, Metis creates
  `.metis/metis.db` in the project root and auto-writes `.metis/.gitignore`
  (`*` + `!.gitignore`) so the database never enters version control.
- **Migrations are versioned.** Numbered SQL files under
  `scripts/lib/migrations/` are gated by `PRAGMA user_version`; reruns are no-ops.
- **Retrieval is FTS5 + BM25.** Task text is tokenized to lowercase alphanumeric
  runs, each quoted as a literal and OR-joined. Operators in user input cannot
  produce a syntactically invalid MATCH query. Rows with `NULL` result (aborted
  or failed delegations) are excluded from retrieval.
- **Prompt injection is byte-for-byte.** The exact `<past_work>` block sent to
  Codex is also stored in `context_injected`. Best-effort cap of ~1,500 tokens;
  each entry's `result` field is truncated to 500 chars.
- **Failure contract.** The row is `INSERT`'d before the provider call (with `NULL`
  result) and `UPDATE`'d on success. Abort or failure leaves it with `NULL` — never
  partial. `/metis:tag` targets the latest row by `id DESC`, never `ts` (second-granularity timestamps collide on rapid calls).

The binding spec is [`_bmad-output/planning-artifacts/prd.md`](_bmad-output/planning-artifacts/prd.md).
Implementation notes in that file are normative.

---

## Status & roadmap

- ✓ **Phase 1** — plugin scaffold + Codex delegation
- ✓ **Phase 1.1** — FTS5 sync triggers + backfill (closes a Phase 1 spec defect)
- ✓ **Phase 2a** — FTS5 retrieval + prompt injection
- ✓ **Phase 2b** — `/metis:status` (last 10 + 7-day summary)
- ⏳ **Phase 3** — Copilot provider + routing (gated on ~30 real tagged delegations across Phases 1–2)

Thompson Sampling, four-network memory, a Critic subagent, semantic embeddings,
git-attribution outcome signals, and cross-repo aggregation are all **out of v1
by design**. See the PRD's "Explicitly Out of Scope for v1" table.

---

## Data

The database lives at `<repo>/.metis/metis.db`, one per repo. It is never
aggregated across repos, never sent over the network, and is gitignored at the
directory level. Schema: a single `delegations` table — see the PRD's
"What Gets Stored" section.

Inspect, or dump to CSV for review:

```
sqlite3 .metis/metis.db "SELECT id, datetime(ts,'unixepoch'), task_type, provider, tag FROM delegations ORDER BY id DESC LIMIT 20;"

sqlite3 .metis/metis.db -header -csv "SELECT id, datetime(ts,'unixepoch') AS when_, task_type, provider, substr(task,1,80) AS task, tag FROM delegations ORDER BY id;" > delegations.csv
```

v1 has no built-in export or cross-repo aggregation — a v1.x candidate if the
usage period shows real need.

---

## License

Apache 2.0. Plugin structure follows the
[`openai/codex-plugin-cc`](https://github.com/openai/codex-plugin-cc) pattern.
