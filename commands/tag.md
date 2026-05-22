---
description: Tag a Metis delegation as good or bad. Omit the ID to tag the most recent; supply an ID (visible in /metis:status) to tag a specific one. Invoke only when the user explicitly asks.
argument-hint: "good|bad [id]"
disable-model-invocation: true
allowed-tools: Bash(node *)
---

Tag a Metis delegation.

The user's argument is `$ARGUMENTS`.

Parse it as `<value> [id]` where `<value>` is `good` or `bad` and `id` is an optional integer.

If `<value>` is not `good` or `bad`, do not run the command — tell the user the only valid values are `good` or `bad`.

Otherwise use the Bash tool to run:

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/metis.mjs" tag <VALUE> [ID]
```

Include `[ID]` only if the user supplied one. Report the confirmation line from the command's stdout.
