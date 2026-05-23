import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildPrompt } from '../scripts/lib/retrieval.mjs';

// Mirrors the constants in retrieval.mjs so the budget assertions stay honest
// if the source values are changed.
const BUDGET_TOKENS = 1500;
const RESULT_CAP = 500;
const estimateTokens = (s) => Math.ceil(s.length / 4);

function makeRow({ id = 1, tag = null, provider = 'codex', task = 't', result = 'r' } = {}) {
  return { id, tag, provider, task, result };
}

describe('buildPrompt — empty rows', () => {
  it('returns the raw task and null contextInjected for []', () => {
    const out = buildPrompt([], 'do the thing');
    assert.deepEqual(out, { prompt: 'do the thing', contextInjected: null });
  });

  it('returns the raw task and null contextInjected for null', () => {
    const out = buildPrompt(null, 'do the thing');
    assert.deepEqual(out, { prompt: 'do the thing', contextInjected: null });
  });

  it('returns the raw task and null contextInjected for undefined', () => {
    const out = buildPrompt(undefined, 'do the thing');
    assert.deepEqual(out, { prompt: 'do the thing', contextInjected: null });
  });
});

describe('buildPrompt — with rows', () => {
  it('wraps a <past_work> block and appends Current task line', () => {
    const { prompt } = buildPrompt([makeRow({ task: 'prior', result: 'fine' })], 'now');
    assert.ok(prompt.startsWith('<past_work>\n'), 'prompt starts with <past_work>');
    assert.ok(prompt.includes('</past_work>'), 'prompt closes the past_work block');
    assert.ok(prompt.endsWith('\n\nCurrent task: now'), 'prompt ends with Current task line');
  });

  it('contextInjected is byte-for-byte identical to prompt', () => {
    const rows = [
      makeRow({ id: 1, tag: 'good', provider: 'codex',  task: 'a', result: 'r1' }),
      makeRow({ id: 2, tag: 'bad',  provider: 'copilot', task: 'b', result: 'r2' }),
    ];
    const { prompt, contextInjected } = buildPrompt(rows, 'next');
    // strictEqual checks reference identity for strings of equal value — but the
    // stronger contract we want is value identity: every byte the same.
    assert.equal(contextInjected, prompt);
    assert.equal(Buffer.byteLength(contextInjected, 'utf8'), Buffer.byteLength(prompt, 'utf8'));
  });
});

describe('buildPrompt — tag markers', () => {
  it('renders "✓ helped" for tag=good', () => {
    const { prompt } = buildPrompt([makeRow({ tag: 'good' })], 'q');
    assert.ok(prompt.includes('✓ helped'), 'good tag renders ✓ helped');
    assert.ok(!prompt.includes('✗ did not help'));
    assert.ok(!prompt.includes('~ untagged'));
  });

  it('renders "✗ did not help" for tag=bad', () => {
    const { prompt } = buildPrompt([makeRow({ tag: 'bad' })], 'q');
    assert.ok(prompt.includes('✗ did not help'), 'bad tag renders ✗ did not help');
    assert.ok(!prompt.includes('✓ helped'));
    assert.ok(!prompt.includes('~ untagged'));
  });

  it('renders "~ untagged" for tag=null', () => {
    const { prompt } = buildPrompt([makeRow({ tag: null })], 'q');
    assert.ok(prompt.includes('~ untagged'), 'null tag renders ~ untagged');
    assert.ok(!prompt.includes('✓ helped'));
    assert.ok(!prompt.includes('✗ did not help'));
  });
});

describe('buildPrompt — token-budget shrink loop', () => {
  // Sized so the budget-shrink loop is forced to drop entries AND then halve
  // the per-result cap. Math: each entry ≈ task + cap + ~50 chars of scaffolding;
  // budget in chars ≈ BUDGET_TOKENS * 4 = 6000. With task=5500 chars:
  //   3 entries → ~18000 chars (>6000) → shrink to 2
  //   2 entries → ~12000 chars (>6000) → shrink to 1
  //   1 entry  → ~6050 chars  (>6000) → enter cap-halving loop
  //   cap=250  → ~6050-250 ≈ ~5800 — still > 6000? recompute:
  //   1 entry with cap C: 5500 + C + 50(scaffolding) + 300(header) ≈ 5850 + C
  //   cap=500 → 6350 (>6000); cap=250 → 6100 (>6000); cap=125 → 5975 (<6000)
  const longTask = 'x'.repeat(5500);
  const longResult = 'y'.repeat(3000);
  const rows = [
    makeRow({ id: 1, task: longTask, result: longResult, provider: 'codex' }),
    makeRow({ id: 2, task: longTask, result: longResult, provider: 'codex' }),
    makeRow({ id: 3, task: longTask, result: longResult, provider: 'codex' }),
  ];

  it('drops entries down to a single one when 3 rows blow the budget', () => {
    const { prompt } = buildPrompt(rows, 'q');
    const block = prompt.split('\n\nCurrent task: ')[0];
    // Only entry [1] should remain — no [2] or [3] markers.
    assert.ok(/\[1\]/.test(block), 'entry [1] is present');
    assert.ok(!/\[2\]/.test(block), 'entry [2] was dropped');
    assert.ok(!/\[3\]/.test(block), 'entry [3] was dropped');
  });

  it('halves the per-entry result cap after dropping to 1 entry', () => {
    const { prompt } = buildPrompt(rows, 'q');
    const block = prompt.split('\n\nCurrent task: ')[0];
    // After cap-halving, the rendered y-run is much shorter than the original
    // 3000 chars and strictly shorter than the default RESULT_CAP of 500.
    const yRun = block.match(/y+/)?.[0] ?? '';
    assert.ok(yRun.length > 0, 'some result content remains');
    assert.ok(
      yRun.length < RESULT_CAP,
      `result was truncated below RESULT_CAP (got ${yRun.length})`,
    );
    assert.ok(block.includes('…'), 'truncation marker present');
  });

  it('final block fits within ~BUDGET_TOKENS', () => {
    const { prompt } = buildPrompt(rows, 'q');
    const block = prompt.split('\n\nCurrent task: ')[0];
    assert.ok(
      estimateTokens(block) <= BUDGET_TOKENS,
      `block estimate ${estimateTokens(block)} > BUDGET ${BUDGET_TOKENS}`,
    );
  });
});

describe('buildPrompt — result-cap truncation', () => {
  it('truncates results past RESULT_CAP and appends "…"', () => {
    // task short enough that no budget shrinking happens; result is RESULT_CAP+100
    // so the cap path is the only thing that fires.
    const row = makeRow({ task: 'short', result: 'z'.repeat(RESULT_CAP + 100) });
    const { prompt } = buildPrompt([row], 'q');
    const zRun = prompt.match(/z+/)?.[0] ?? '';
    assert.equal(zRun.length, RESULT_CAP, 'result truncated to exactly RESULT_CAP');
    // The "…" character should follow the z-run directly.
    assert.ok(prompt.includes('z'.repeat(RESULT_CAP) + '…'), 'ellipsis appended after cap');
  });

  it('does not append "…" when the result is at or below the cap', () => {
    const row = makeRow({ task: 'short', result: 'z'.repeat(RESULT_CAP) });
    const { prompt } = buildPrompt([row], 'q');
    assert.ok(!prompt.includes('…'), 'no truncation marker when result <= cap');
  });
});
