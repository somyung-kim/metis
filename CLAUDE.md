# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

This is the **development repository for Metis itself** — a Claude Code plugin that
delegates a coding task to the Codex CLI (later Copilot), records it to a per-repo
SQLite memory, and uses that memory to inform the next delegation. It is not a
typical app: the deliverable is the plugin in this repo.

Development is **PRD-driven and phased**. Phase 1 (scaffold + Codex delegation) is
built and merged. Phase 2 = FTS5 retrieval + `/metis:status`. Phase 3 = Copilot
provider + routing.

## Source of truth & scope discipline (read first)

- `_bmad-output/planning-artifacts/prd.md` is the **single normative spec**. There is
  no separate architecture doc — by deliberate decision, the PRD's
  **"Implementation Notes"** section carries the exact contracts (schema, prompt
  template, token budget, routing function, migration runner, pragmas). Treat
  Implementation Notes as binding; do not paraphrase or re-derive it.
- `prd-v2-reference.md` and `architecture-v2-reference.md` are **explicitly OUT OF
  SCOPE** (Thompson Sampling, four-network memory, Critic subagent, Q-values, etc.).
  Reaching for anything in those docs is the known scope-drift failure mode — stop
  and confirm with the user instead.
- A phase does not start until the prior phase is verified **and** real usage data
  exists (Phase 2 needs ~10 real tagged delegations). "It compiles" is not
  verification; "I ran it and observed X" is.

## Commands

```bash
npm install                                   # one native dep: better-sqlite3 (needs Node >=20, matching Claude Code's Node ABI)
node scripts/metis.mjs do "<task>"            # core delegation (run from the target project's cwd)
node scripts/metis.mjs tag <good|bad>         # tag the most recent delegation
claude plugin validate .                       # validate the plugin manifest
claude plugin install .   # or: claude --plugin-dir .   # install/use locally as /metis:do, /metis:tag
```

There is **no build step** (native `.mjs` ESM, no TypeScript) and **no test
framework**. Phase verification is done by running the script directly and
inspecting `.metis/metis.db` against the PRD's per-phase success criteria.

## Architecture (the cross-file picture)

A delegation flows: `/metis:do` → `commands/do.md` (instruction-based: it tells
Claude to run the script via the Bash tool) → `scripts/metis.mjs` dispatch →
`classifyTaskType` + `.metis/` bootstrap → `scripts/lib/memory.mjs` opens the db
(pragmas + idempotent migration) and **INSERTs the row before delegating**
(`result` NULL) → `scripts/lib/providers/codex.mjs` spawns the provider →
`memory.mjs` **UPDATEs `result`** → stdout is relayed back.

- **Per-repo memory:** `.metis/metis.db` is created in the **invoking project's
  `process.cwd()`**, not the plugin directory. One `delegations` table +
  `delegations_fts` (FTS5 unused until Phase 2). Migrations are numbered SQL files
  gated by `PRAGMA user_version`; each migration ends with `PRAGMA user_version = N`.
- **Commands are instruction-based, not `!`-injection.** `disable-model-invocation:
  true` (side effects + billing — never auto-invoked). The command body must pass
  the user task to the script as a single safely-quoted argument; never interpolate
  `$ARGUMENTS` into a shell string (injection vector).

## Project invariants (non-obvious; violating these breaks the design)

- **Codex invocation is LOCKED:** `codex exec "<prompt>" --sandbox workspace-write`.
  The `--sandbox workspace-write` flag is required (`exec` defaults to read-only,
  which blocks code edits). The PRD's code snippet omits it — do not copy verbatim.
- **AbortSignal / failure contract:** the row is INSERTed before delegation with
  `result` NULL; on abort or failure the row stays unchanged (NULL `result`, NULL
  `tag`). Never write a partial result.
- **Tag targets the latest row by `id DESC`**, never `ts` (second granularity
  collides on rapid calls).
- **Metis is non-intrusive:** it writes its own `.metis/.gitignore` (`*` +
  `!.gitignore`) and never modifies the host repo's `.gitignore`.
- Delegation auth/billing is the user's ambient `codex` setup; Metis manages
  neither. A future "Claude provider" must use Claude Code's native Task subagent,
  **not `claude -p`** (post-2026-06-15 separate Agent SDK credit pool).

## Working norms (enforced in this project)

- **Plan before writing.** Present a plan (goal, files, approach, scope,
  acceptance) and get explicit approval ("approved"/"go"/"ship") before creating or
  editing any file. Continuing the conversation is not approval.
- **Minimal change.** Every changed line maps to the request, a failing check, or
  an in-session observation. No unsolicited refactors/renames/abstractions.
- **No assumptions.** Back claims about the code with a file/grep/command read this
  session; if unknown, say so and ask.
- Code work on `feature/*` branches; the user owns `main` merges. No
  `Co-authored-by` trailers.
