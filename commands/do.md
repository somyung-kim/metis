---
description: Delegate a coding task via Metis and record the delegation to .metis/metis.db. Invoke only when the user explicitly asks.
argument-hint: "<task description> [--provider codex|copilot|claude]"
disable-model-invocation: true
allowed-tools: Bash(node *), Agent
---

Delegate the user's coding task through the Metis CLI.

The user's argument is `$ARGUMENTS`.

Parse it as `<task> [--provider <name>]`. The task is everything before `--provider` (if present); the provider name is the token after `--provider`. Valid provider names: `codex`, `copilot`, `claude`.

## Step 1 — Prepare the delegation

Use the Bash tool to run:

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/metis.mjs" prepare "<TASK>"
```

If the user supplied `--provider <name>`, append it as two separate arguments:

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/metis.mjs" prepare "<TASK>" --provider "<name>"
```

Pass the task **verbatim as a single shell argument** — do not interpret, expand, summarize, or modify it, and quote it so that any shell metacharacters in the task are not evaluated. Never interpolate the provider name into a shell string without quoting.

Stdout from `prepare` is **a single line of JSON** with this exact shape (other text on stderr is informational and should be ignored for control flow):

```json
{"rowId": <integer>, "provider": "codex"|"copilot"|"claude", "prompt": "<the full prompt to send>"}
```

Parse that JSON. If parsing fails or the command exited non-zero, report the error to the user and stop — no row is in an inconsistent state because `prepare` either inserts the row and emits JSON or fails before inserting.

## Step 2 — Dispatch by provider

### If `provider === "claude"`

Use the **Agent** tool to spawn the `metis:metis-claude` subagent. Pass:

- `subagent_type`: `"metis:metis-claude"` (plugin-namespaced — Claude Code installs plugin agents as `<plugin-name>:<agent-name>`; the bare `metis-claude` will NOT match)
- `description`: a short label such as `"Metis claude delegation"`
- `prompt`: the **exact `prompt` string** from the JSON above, byte-for-byte (do not edit, summarize, or wrap it)

When the Agent tool returns, take its final result string and record it:

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/metis.mjs" record <ROW_ID> "<RESULT>"
```

Quote the result as a single shell argument. Relay the result to the user as the delegation output.

If the Agent tool fails or is interrupted before returning, do **not** call `record`. The row will remain with NULL `result` (visible in `/metis:status`), and the user can retry or delete it.

### Else (`provider === "codex"` or `provider === "copilot"`)

Use the Bash tool to run:

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/metis.mjs" delegate <ROW_ID>
```

This spawns the appropriate provider subprocess, records the result on success, and writes the provider's output to stdout. Relay that stdout to the user.

If the command exits non-zero, report the error message and note that the delegation row was recorded with no result and no tag — the user can retry the task or delete the row later.
