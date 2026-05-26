# Metis

> A Claude Code plugin that delegates a coding task to the Codex, Copilot, or Claude CLI,
> records what happened in a per-repo SQLite memory, and uses that memory to inform the next delegation.

**Status:** v1 · released as `v0.1.0` · MIT · Node ≥20. v2 is deferred pending
real-usage evidence — see [`docs/v2-notes.md`](docs/v2-notes.md) for the design
record of why, and what would need to be true to revisit it.

---

## Install

1. **Clone + install dependencies.** `better-sqlite3` is a native module compiled
   against this machine's Node — must match Claude Code's Node ABI (`engines` pin: `>=20`).

   ```
   git clone https://github.com/somyung-kim/metis.git
   cd metis
   npm install
   ```

2. **Register with Claude Code** — either as a persistent plugin or for one session.

   Persistent (recommended for daily use). The repo ships a single-plugin
   marketplace manifest at `.claude-plugin/marketplace.json`, so the flow is
   marketplace-add then plugin-install:

   ```
   claude plugin marketplace add /absolute/path/to/metis
   claude plugin install metis@metis
   ```

   Dev / one-shot (no install, current session only):

   ```
   claude --plugin-dir /absolute/path/to/metis
   ```

   Sanity-check the manifest at any time:

   ```
   claude plugin validate .
   ```

3. **Install + authenticate the Codex CLI.** Metis spawns `codex exec` as a
   subprocess under your ambient credentials; it does not manage Codex auth or billing.

4. **(Optional) Install + authenticate the GitHub Copilot CLI** if you intend to use
   the `copilot` provider. Same principle — Metis spawns it as a subprocess; auth and
   billing are yours.

Verify the plugin loaded with `/metis:status` — with no delegations yet it should print an empty summary, not an error.

---

## Commands

All three commands have `disable-model-invocation: true` — Claude never invokes them autonomously, only when you type the slash command.

### `/metis:do "<task>" [--provider codex|copilot|claude]`

Delegate a coding task. Before invoking the provider, Metis runs an FTS5 query
against this repo's prior delegations and injects up to three of the most similar
past tasks (with their tagged outcomes) into the prompt as reference context.

The provider is selected automatically by the router (see "How it works"). Use
`--provider` to override it for a single delegation.

```
/metis:do "add a /health endpoint returning the build SHA"
/metis:do "refactor the auth middleware" --provider claude
```

### `/metis:tag good|bad [id]`

Tag a delegation. Omit `id` to tag the most recent one; supply the numeric ID
(visible in `/metis:status`) to tag a specific past delegation. The tag is v1's
success signal — it answers "did you have to re-explain context or correct the result?"

```
/metis:tag good
/metis:tag bad
/metis:tag good 42
```

### `/metis:status`

Print the last 10 delegations and a rolling 7-day summary. Takes no arguments.

```
/metis:status
```

Example output:

```
Last 10 delegations:
  [✓] 2026-05-20 14:32  feature (claude)      add a /health endpoint returning the build SHA
  [✗] 2026-05-20 11:08  fix (copilot)         fix the off-by-one in pagination
  [~] 2026-05-19 22:14  explain (codex)       what does scripts/lib/retrieval.mjs do
  [✓] 2026-05-19 17:51  refactor (claude)     split do.md command logic into helpers
  [✓] 2026-05-19 09:02  feature (copilot)     wire up the weather provider to the dashboard

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
  the provider is also stored in `context_injected`. Best-effort cap of ~1,500 tokens;
  each entry's `result` field is truncated to 500 chars.
- **Routing is deliberately simple.** The router picks the provider from the nearest
  tagged-good past delegation surfaced by retrieval; it falls back to Codex when no
  tagged-good match exists. Override for a single delegation with `--provider`.
- **Follow-up messages are captured.** A `UserPromptSubmit` hook appends subsequent
  user messages to the most recent delegation row's `followup_messages` field, so
  the correction or clarification stays with the delegation that prompted it.
- **Failure contract.** The row is `INSERT`'d before the provider call (with `NULL`
  result) and `UPDATE`'d on success. Abort or failure leaves it with `NULL` — never
  partial. `/metis:tag` targets a row by `id DESC` (or an explicit ID), never `ts`
  (second-granularity timestamps collide on rapid calls).

---

## Status & roadmap

- ✓ **Phase 1** — plugin scaffold + Codex delegation
- ✓ **Phase 1.1** — FTS5 sync triggers + backfill (closes a Phase 1 spec defect)
- ✓ **Phase 2a** — FTS5 retrieval + prompt injection
- ✓ **Phase 2b** — `/metis:status` (last 10 + 7-day summary)
- ✓ **Phase 3** — Copilot provider + routing; `--provider` override flag; tag-by-ID
- ✓ **Phase 4** — Claude provider via native Agent subagent; follow-up message capture

Thompson Sampling, four-network memory, a Critic subagent, semantic embeddings,
git-attribution outcome signals, and cross-repo aggregation are all **out of v1
by design**. The honest version of *why* — including the credit-assignment
problem at the heart of v2 and the gate order ("measurement before mechanism")
any future attempt should follow — is in [`docs/v2-notes.md`](docs/v2-notes.md).

---

## Data

The database lives at `<repo>/.metis/metis.db`, one per repo. It is never
aggregated across repos, never sent over the network, and is gitignored at the
directory level. Schema: a single `delegations` table (id, ts, task, task_type, provider, context_injected, result, tag, followup_messages).

Inspect, or dump to CSV for review:

```
sqlite3 .metis/metis.db "SELECT id, datetime(ts,'unixepoch'), task_type, provider, tag FROM delegations ORDER BY id DESC LIMIT 20;"

sqlite3 .metis/metis.db -header -csv "SELECT id, datetime(ts,'unixepoch') AS when_, task_type, provider, substr(task,1,80) AS task, tag FROM delegations ORDER BY id;" > delegations.csv
```

v1 has no built-in export or cross-repo aggregation — a v1.x candidate if the
usage period shows real need.

---

## License

MIT. Plugin structure follows the
[`openai/codex-plugin-cc`](https://github.com/openai/codex-plugin-cc) pattern.
