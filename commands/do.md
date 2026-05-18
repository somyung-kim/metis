---
description: Delegate a coding task to Codex via Metis and record the delegation to .metis/metis.db. Invoke only when the user explicitly asks.
argument-hint: "<task description>"
disable-model-invocation: true
allowed-tools: Bash(node *)
---

Delegate the user's coding task to Codex through the Metis CLI.

Use the Bash tool to run the command below. Pass the user's task **verbatim as a single shell argument** — do not interpret, expand, summarize, or modify it, and quote it so that any shell metacharacters in the task are not evaluated:

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/metis.mjs" do "<TASK>"
```

`<TASK>` is exactly the following text:

$ARGUMENTS

After the command finishes, relay the command's stdout (Codex's output) back to the user as the result of the delegation. If the command exits non-zero, report the error message and note that the delegation row was recorded with no result and no tag — the user can retry the task or delete the row later.
