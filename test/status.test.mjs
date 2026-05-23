import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatStatus } from '../scripts/lib/status.mjs';

// fmtTime() in status.mjs renders YYYY-MM-DD HH:MM in local time, so direct
// string comparisons on the timestamp are TZ-dependent. Tests assert format
// shape via regex and pin everything else exactly.
const TIME_RE = /\d{4}-\d{2}-\d{2} \d{2}:\d{2}/;

function emptySummary() {
  return { total: 0, tagged: 0, good: 0, bad: 0, untagged: 0 };
}

function makeRow({
  id = 1,
  ts = 1_700_000_000,
  task = 'do thing',
  task_type = 'feature',
  provider = 'codex',
  tag = null,
  followup_messages = null,
  result = 'ok',
} = {}) {
  return { id, ts, task, task_type, provider, tag, followup_messages, result };
}

describe('formatStatus — empty delegations', () => {
  it('emits "(no delegations yet)" when last is []', () => {
    const out = formatStatus({ last: [], summary: emptySummary() });
    assert.ok(out.includes('  (no delegations yet)'));
    assert.ok(out.startsWith('Last 10 delegations:\n'));
  });

  it('emits "(no delegations yet)" when last is null/undefined', () => {
    for (const last of [null, undefined]) {
      const out = formatStatus({ last, summary: emptySummary() });
      assert.ok(out.includes('  (no delegations yet)'));
    }
  });
});

describe('formatStatus — weekly summary good-ratio math', () => {
  it('renders "n/a" when tagged is 0 (no division by zero)', () => {
    const out = formatStatus({
      last: [],
      summary: { total: 5, tagged: 0, good: 0, bad: 0, untagged: 5 },
    });
    assert.ok(out.includes('Good ratio: n/a'));
  });

  it('renders the rounded percentage when tagged > 0', () => {
    const out = formatStatus({
      last: [],
      summary: { total: 4, tagged: 4, good: 2, bad: 2, untagged: 0 },
    });
    assert.ok(out.includes('Good ratio: 50%'));
  });

  it('rounds the ratio (1/3 -> 33%)', () => {
    const out = formatStatus({
      last: [],
      summary: { total: 3, tagged: 3, good: 1, bad: 2, untagged: 0 },
    });
    assert.ok(out.includes('Good ratio: 33%'));
  });

  it('echoes total/tagged/good/bad/untagged counts verbatim', () => {
    const out = formatStatus({
      last: [],
      summary: { total: 10, tagged: 6, good: 4, bad: 2, untagged: 4 },
    });
    assert.ok(out.includes('Total delegations: 10'));
    assert.ok(out.includes('Tagged: 6 (good: 4, bad: 2)'));
    assert.ok(out.includes('Untagged: 4'));
  });
});

describe('formatStatus — row markers', () => {
  it('renders [✓] for tag=good', () => {
    const out = formatStatus({ last: [makeRow({ tag: 'good' })], summary: emptySummary() });
    assert.ok(/\n  \[✓\] /.test(out), 'good marker present');
  });

  it('renders [✗] for tag=bad', () => {
    const out = formatStatus({ last: [makeRow({ tag: 'bad' })], summary: emptySummary() });
    assert.ok(/\n  \[✗\] /.test(out), 'bad marker present');
  });

  it('renders [~] for tag=null', () => {
    const out = formatStatus({ last: [makeRow({ tag: null })], summary: emptySummary() });
    assert.ok(/\n  \[~\] /.test(out), 'untagged marker present');
  });
});

describe('formatStatus — row suffixes', () => {
  it('appends " · no result" when result is null', () => {
    const out = formatStatus({
      last: [makeRow({ task: 'orphaned', result: null })],
      summary: emptySummary(),
    });
    assert.ok(out.includes('orphaned · no result'), 'no-result suffix present');
  });

  it('appends " · no result" when the result field is absent (== null check covers undefined)', () => {
    // Built directly — makeRow's `result = 'ok'` default param would swallow
    // an explicit `result: undefined` argument. The source check is
    // `row.result == null`, which matches both null and undefined.
    const row = {
      id: 1, ts: 1_700_000_000, task: 'orphaned',
      task_type: 'feature', provider: 'codex', tag: null,
      followup_messages: null,
    };
    const out = formatStatus({ last: [row], summary: emptySummary() });
    assert.ok(out.includes('orphaned · no result'));
  });

  it('omits the no-result suffix when result is a string (incl. empty)', () => {
    const out = formatStatus({
      last: [makeRow({ task: 'done', result: '' })],
      summary: emptySummary(),
    });
    assert.ok(!out.includes('no result'), 'no-result suffix absent for empty-string result');
  });

  it('appends "[+N]" when followup_messages has N entries', () => {
    const out = formatStatus({
      last: [makeRow({ task: 'with-followups', followup_messages: JSON.stringify(['a', 'b']) })],
      summary: emptySummary(),
    });
    assert.ok(out.includes('with-followups [+2]'), 'followup count suffix present');
  });

  it('omits the [+N] suffix when followup_messages is null', () => {
    const out = formatStatus({
      last: [makeRow({ task: 'no-followups', followup_messages: null })],
      summary: emptySummary(),
    });
    assert.ok(!out.includes('[+'), 'followup suffix absent');
  });

  it('omits the [+N] suffix when followup_messages is an empty array', () => {
    const out = formatStatus({
      last: [makeRow({ task: 'empty-followups', followup_messages: JSON.stringify([]) })],
      summary: emptySummary(),
    });
    assert.ok(!out.includes('[+'), 'followup suffix absent for empty array');
  });

  it('falls back to 0 followups when followup_messages is invalid JSON (catch branch)', () => {
    const out = formatStatus({
      last: [makeRow({ task: 'bad-json', followup_messages: '{not json' })],
      summary: emptySummary(),
    });
    assert.ok(!out.includes('[+'), 'invalid JSON does not produce a [+N] suffix');
    assert.ok(out.includes('bad-json'), 'row still renders');
  });

  it('combines no-result and followup suffixes in order (no-result, then [+N])', () => {
    const out = formatStatus({
      last: [makeRow({
        task: 'aborted-with-msgs',
        result: null,
        followup_messages: JSON.stringify(['retry?']),
      })],
      summary: emptySummary(),
    });
    assert.ok(out.includes('aborted-with-msgs · no result [+1]'));
  });
});

describe('formatStatus — row scaffolding', () => {
  it('includes a YYYY-MM-DD HH:MM timestamp and task_type (provider)', () => {
    const out = formatStatus({
      last: [makeRow({ task_type: 'fix', provider: 'codex', task: 'bug' })],
      summary: emptySummary(),
    });
    assert.ok(TIME_RE.test(out), 'timestamp format present');
    assert.ok(out.includes('fix (codex)'), 'task_type (provider) present');
  });
});
