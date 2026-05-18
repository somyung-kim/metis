---
description: Tag the most recent Metis delegation as good or bad. Invoke only when the user explicitly asks.
argument-hint: "good|bad"
disable-model-invocation: true
allowed-tools: Bash(node *)
---

Tag the most recent Metis delegation.

The user's argument should be exactly `good` or `bad`:

$ARGUMENTS

If it is `good` or `bad`, use the Bash tool to run:

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/metis.mjs" tag <VALUE>
```

where `<VALUE>` is the single word the user provided. Report the confirmation line from the command's stdout.

If the argument is anything other than `good` or `bad`, do not run the command — tell the user the only valid options are `good` or `bad`.
