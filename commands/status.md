---
description: Show the last 10 Metis delegations + a 7-day rolling good/bad summary. Invoke only when the user explicitly asks.
argument-hint: ""
disable-model-invocation: true
allowed-tools: Bash(node *)
---

Render the Metis status.

Use the Bash tool to run:

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/metis.mjs" status
```

This command takes no arguments. Relay the command's stdout to the user **verbatim** — it is a pre-formatted text rendering (last 10 delegations + weekly summary). Do not paraphrase, reformat, or annotate it. If `.metis/` doesn't exist yet in the current repo, the command will still succeed and render an empty summary; pass that through unchanged.
