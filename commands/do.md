---
description: Delegate a coding task via Metis and record the delegation to .metis/metis.db. Invoke only when the user explicitly asks.
argument-hint: "<task description> [--provider codex|copilot|claude]"
disable-model-invocation: true
allowed-tools: Bash(node *), Bash(mktemp *), Agent, Write
---

Delegate the user's coding task through the Metis CLI.

The user's argument is `$ARGUMENTS`.

Parse it as `<task> [--provider <name>]`. The task is everything before `--provider` (if present); the provider name is the token after `--provider`. Valid provider names: `codex`, `copilot`, `claude`.

**Shell-safety contract:** Untrusted payloads (the user's task here, and later the subagent's result for the Claude branch) **MUST NOT be interpolated into a shell command**. Double-quoted shell arguments still expand `$(…)`, backticks, and `$VAR` — a task or result containing those constructs would execute on the user's machine. Always pass these payloads via the Write tool into a new file inside a generated tmp directory, then reference the file path. Provider names are a bounded enum (`codex`/`copilot`/`claude`) and are safe to pass as quoted shell arguments.

## Step 1 — Prepare the delegation

**1a.** Use the Bash tool to generate a unique tmp directory:

```
mktemp -d "${TMPDIR:-/tmp}/metis-task.XXXXXX"
```

Treat stdout as `<TASK_DIR>`, and set `<TASK_FILE>` to `<TASK_DIR>/task.txt`. Do not create `<TASK_FILE>` with Bash.

**1b.** Use the Write tool to write the task to that tmp file:
- `file_path`: `<TASK_FILE>`
- `content`: the **exact `<TASK>` string** parsed from `$ARGUMENTS`, byte-for-byte (do not escape, expand, summarize, or modify)

**1c.** Use the Bash tool to run prepare with the generated path:

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/metis.mjs" prepare --from-file "<TASK_FILE>"
```

If the user supplied `--provider <name>`, append it as two separate arguments:

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/metis.mjs" prepare --from-file "<TASK_FILE>" --provider "<name>"
```

(`prepare` reads the file and unlinks it after reading.)

Stdout from `prepare` is **a single line of JSON** with this exact shape (other text on stderr is informational and should be ignored for control flow):

```json
{"rowId": <integer>, "provider": "codex"|"copilot"|"claude", "prompt": "<the full prompt to send>"}
```

Parse that JSON. If the command exits non-zero or the JSON cannot be parsed, report the error to the user and stop — no row is in an inconsistent state because `prepare` either inserts the row and emits JSON or fails before inserting.

## Step 2 — Dispatch by provider

### If `provider === "claude"`

**2a.** Use the **Agent** tool to spawn the `metis:metis-claude` subagent. Pass:

- `subagent_type`: `"metis:metis-claude"` (plugin-namespaced — Claude Code installs plugin agents as `<plugin-name>:<agent-name>`; the bare `metis-claude` will NOT match)
- `description`: a short label such as `"Metis claude delegation"`
- `prompt`: the **exact `prompt` string** from the JSON above, byte-for-byte (do not edit, summarize, or wrap it)

**2b.** When the Agent tool returns, use the Bash tool to generate a unique result tmp directory:

```
mktemp -d "${TMPDIR:-/tmp}/metis-result-<ROW_ID>.XXXXXX"
```

Substitute the rowId from the JSON before running `mktemp` (for example, `/tmp/metis-result-42.XXXXXX`). Treat stdout as `<RESULT_DIR>`, and set `<RESULT_FILE>` to `<RESULT_DIR>/result.txt`. Do not create `<RESULT_FILE>` with Bash.

**2c.** Use the Write tool to drop the subagent's reply into that tmp file:
- `file_path`: `<RESULT_FILE>`
- `content`: the subagent's actual answer to the task — its content verbatim, with no paraphrasing, summarizing, or shortening. If the Claude Code runtime appends wrapper text around the reply (continuation hints, telemetry, session metadata, etc.), exclude that wrapper — only the subagent's own answer belongs in the result.

**2d.** Use the Bash tool to run record with the generated path:

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/metis.mjs" record <ROW_ID> --from-file "<RESULT_FILE>"
```

**2e.** Check the exit status. If `record` succeeded, relay the result to the user as the delegation output. If `record` exited non-zero, report the error and tell the user the delegation completed successfully but the result was NOT recorded (row left with NULL `result`, visible in `/metis:status` as "no result"). Still relay the result content to the user so they have it.

If the Agent tool fails or is interrupted before step 2b, do not generate or write the result file or call `record`. The row remains with NULL `result` (visible in `/metis:status` as "no result"), and the user can retry or delete it.

### Else (`provider === "codex"` or `provider === "copilot"`)

Use the Bash tool to run:

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/metis.mjs" delegate <ROW_ID>
```

This spawns the appropriate provider subprocess, records the result on success, and writes the provider's output to stdout. Relay that stdout to the user.

If the command exits non-zero, report the error message and note that the delegation row was recorded with no result and no tag — the user can retry the task or delete the row later.
