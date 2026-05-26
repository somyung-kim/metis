# v2 Notes — The Learning Problem, and Why v1 Stops Where It Does

**Status:** Design record, not a roadmap commitment. This documents *why* the ambitious version of Metis was deferred and what it would actually take to build it correctly. v1 is marked done. Whether v2 happens depends on evidence Metis can only gather by being used — see "The premise has a volume problem" below.

This is the honest version of "future work." It is written so that someone (likely me, later) picking this up cold understands not just *what* is unbuilt but *why the unbuilt part is hard* — because the hard part is a genuine open problem, not a backlog item.

---

## What Metis is actually trying to be

The v1 README describes the mechanics: delegate a task, record it, retrieve similar past tasks, inject them into the next prompt. That is the skeleton. It is not the thesis.

The thesis is: **the thing that should improve over time is the delegation prompt, not the provider choice.** Routing — picking Codex vs. Copilot vs. Claude — is the cheapest, most visible output of the memory, and it is close to the least important one. The real product is a memory that accumulates *what was learned* — including why past attempts failed — and uses it to rewrite the next delegation so it carries context the user never re-supplies. When a task that failed once is attempted again, Metis should already know why it broke and prompt around it.

Provider selection is a side effect. Lesson-transfer is the point.

This reframing matters because it changes what "done" and "working" mean. v1 proves the *loop* exists end-to-end (delegate → record → tag → retrieve → inject). It does **not** prove the loop *learns* in any meaningful sense. That gap is the whole of v2, and it is not an engineering gap — it is a measurement-and-validation gap.

---

## The hard part has a name: credit assignment

Recording *that* a delegation failed is trivial (it's the `bad` tag). Recording *why* it failed — in a form that (a) is faithful to what actually happened and (b) can be matched to a future task and injected as useful guidance — is the unsolved core.

This is the credit-assignment problem. It is the same problem reinforcement learning has wrestled with for decades: the outcome signal is real, but attributing it to the right earlier decision is hard in general. Metis does not get to import a clean solution because one does not exist. The current LLM-agent-memory literature lists "retrieve by cause rather than similarity" and "reflect without entrenching errors" as open frontier problems, and names the central danger explicitly: **self-reinforcing error** — a memory that confidently records a wrong cause and then misdirects every future attempt that matches it.

A memory of true-but-useless lessons is recoverable. A memory of confidently-false lessons is worse than no memory at all, because it actively steers the agent wrong while looking like signal. Designing against that is the first obligation of v2, not an afterthought.

---

## The split that organizes everything: *helps* vs. *true*

The trap is treating "is this lesson good?" as one question. It is at least two, and they come apart in a dangerous way:

1. **Does the lesson help?** — Does injecting it improve the outcome on a similar future task? This is measurable, because prompt augmentation is *additive*: the same task can be run with the lesson injected and without it. That A/B is available precisely because, unlike provider choice, the lesson is a thing you can include or omit while holding the task fixed.  
     
2. **Is the recorded cause true?** — Does the lesson accurately describe what actually went wrong? This is *not* fully automatable at v2 maturity. A separately prompted critic can write a plausible cause, but a plausible cause is not a correct one, and the critic cannot certify its own faithfulness (LLM judges carry their own systematic biases).

These dissociate: a lesson can help for the wrong reason (it added generic caution, not because its stated cause was right), and a correct cause can fail to help (the model couldn't act on it). If you only measure "helps," you will accumulate lessons that are useful-but-false — exactly the corpus that rots into self-reinforcing error.

So v2 must validate both axes, with different mechanisms, and must accept that the "true" axis requires periodic human grounding rather than full automation.

---

## What v2 would actually build, in order

The ordering is deliberate and counterintuitive: **measurement before mechanism.** Build the ability to tell whether a lesson is good *before* building the thing that generates lessons. Generating lessons you can't evaluate is how the memory poisons itself.

### Gate 0 — Single-arm instrumentation (cheap, no counterfactual)

Three things measurable from normal usage, no A/B required:

- **Retrieval relevance.** When memory injects past work, was it actually related to the current task? Eyeball a sample. *This is the single measurement that gates the semantic-similarity decision.* If lexical FTS5/BM25 already surfaces relevant rows, embeddings are deferred-justified. If retrieval is noisy, that is the concrete trigger to build semantic similarity — and not before.  
- **Lesson activation rate.** What fraction of stored lessons ever get retrieved and injected? Lessons that never surface are dead weight ("reflection without action").  
- **Override rate.** When the router's pick or an injected lesson is offered, is it accepted or discarded? High override \= the memory disagrees with judgment.

### Gate 1 — The held-out-lesson A/B (the "does it help" test)

Make lesson injection *toggleable from the start*, specifically so the same task can be run with and without the lesson and the outcomes compared. This is the one honest A/B available to Metis. It validates *helpfulness*. It does **not** validate truth.

### Gate 2 — Hand-grounded faithfulness sample (the "is it true" test)

Before trusting any automatic cause-generation at scale, hand-label why \~12 real failures actually happened, then check whether the intended automatic extractor (the Critic) agrees with the human labels on those same cases. If the Critic matches human judgment on the dozen you check, you have earned license to trust it on the cases you don't. If it doesn't, you've caught the poison for the cost of an afternoon instead of discovering it after the memory is full of confident fictions.

This gate cannot be fully automated and should not pretend to be. It is sampling, not coverage.

### Only then — the mechanism

- **Critic / reflection step** that writes structured failure-causes. This is what the v1 README parks as the deferred "Critic subagent." Its job is to turn "it failed" into "it failed because X, so next time Y." It is built *after* Gate 2 exists to check it.  
- **Semantic similarity** for retrieval, built *if and only if* Gate 0 shows lexical retrieval is the bottleneck. Note: for lesson-*transfer* (matching a past failure to a present attempt that is worded differently), semantic similarity is likely the floor, not a luxury — which is a different conclusion than it was for routing alone.  
- **Better outcome signal** than a manual tag. The manual `good`/`bad` tag is sparse and noisy and will be skipped over time. Git-attribution (did the change survive, get reverted, get amended?) is the stronger signal. Build this early in the mechanism phase, because the entire memory is only as good as its outcome signal.

---

## Known failure modes to design against

The literature has already catalogued how reflective memory goes wrong. These are the specific things v2 instrumentation should watch for, rather than a vague "is it good":

- **Self-reinforcing error** — wrong cause recorded once, then entrenched. The headline risk. Gate 2 exists for this.  
- **Over-indexing recent failures** — recency bias causing over-correction; recent reflections shouldn't override proven strategies.  
- **Narrow-context overgeneralization** — a lesson learned in one specific context applied everywhere indiscriminately.  
- **Dead lessons** — stored reflections that are never retrieved (measured by Gate 0's activation rate).

A useful cheap signal for the first of these: **contradiction detection.** When a new lesson contradicts a stored one, surface the conflict instead of silently storing both — one of them is likely wrong, and the disagreement is information.

---

## The premise has a volume problem (the thing that might end this)

The most uncomfortable truth, and the reason v2 is gated on evidence rather than scheduled: per-repo experiential memory only has value if there are enough delegations per repo to learn from. If real usage produces a dozen delegations in a repo over weeks, no amount of v2 sophistication helps — the substrate is too thin.

The first thing real usage tests is therefore *not* the algorithm. It is whether Metis is sticky enough in an actual workflow to generate the data its value depends on. If it isn't, the honest finding is "this needs to be lower-friction / more automatic to justify a memory layer at all" — a design conclusion, not a failure, and one worth knowing before building the expensive parts.

This is why v1 shipped deliberately small: to create room to observe the task distribution before committing to a learning system designed for a distribution that might not exist.

---

## What carries forward from v1

Even if v2 never ships, the v1 data is not wasted:

- The raw `delegations` rows (task, provider, result, outcome, timestamp) are the substrate any future learning method needs, regardless of method.  
- Any free-text "why it failed" captured alongside a `bad` tag — however messy — is the seed corpus for both the future Critic (what to imitate) and the Gate 2 faithfulness check (the hand-labels to check against). A `bad` tag with a sentence of cause is worth far more than a bare `bad` tag.

If you are using v1 with any intent toward v2, jot the *why* when you tag `bad`. It costs a sentence and it is the most valuable thing you can record.

---

## Summary for whoever reads this next

- v1 proves the loop runs. It does not prove the loop learns. That gap is v2.  
- The gap is a real open problem (credit assignment / faithful failure-cause capture), not a backlog item.  
- "Is a lesson good" is two questions — *helps* (A/B-able) and *true* (human-sampled) — and conflating them is the specific way these systems fail.  
- Build measurement before mechanism. The lesson-injection toggle and the faithfulness sample come before the Critic and before embeddings.  
- Whether v2 is worth building at all is an empirical question that only real usage answers. v1 was scoped small on purpose to make room for that observation.

