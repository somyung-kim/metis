---
description: Delegate a coding task via Metis and record the delegation to .metis/metis.db. Invoke only when the user explicitly asks.
argument-hint: "<task description> [--provider codex|copilot]"
disable-model-invocation: true
allowed-tools: Bash(node *)
---

Delegate the user's coding task through the Metis CLI.

The user's argument is `$ARGUMENTS`.

Parse it as `<task> [--provider <name>]`. The task is everything before `--provider` (if present); the provider name is the token after `--provider`.

Use the Bash tool to run:

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/metis.mjs" do "<TASK>"
```

If the user supplied `--provider <name>`, append it as two separate arguments:

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/metis.mjs" do "<TASK>" --provider <name>
```

Pass the task **verbatim as a single shell argument** — do not interpret, expand, summarize, or modify it, and quote it so that any shell metacharacters in the task are not evaluated. Never interpolate the provider name into a shell string without quoting.

After the command finishes, relay the command's stdout back to the user as the result of the delegation. If the command exits non-zero, report the error message and note that the delegation row was recorded with no result and no tag — the user can retry the task or delete the row later.
