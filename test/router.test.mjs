import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { pickProvider, KNOWN_PROVIDERS } from '../scripts/lib/router.mjs';

const FALLBACK = 'codex';

describe('pickProvider — picks nearest tagged-good row', () => {
  it('returns the provider of the first good row (order matters)', () => {
    const rows = [
      { tag: null,   provider: 'copilot' },
      { tag: 'good', provider: 'copilot' },  // nearest good
      { tag: 'good', provider: 'codex' },    // ignored — later in array
    ];
    assert.equal(pickProvider(rows), 'copilot');
  });

  it('skips non-good rows when finding the nearest good', () => {
    const rows = [
      { tag: 'bad',  provider: 'copilot' },
      { tag: null,   provider: 'claude' },
      { tag: 'good', provider: 'claude' },
    ];
    assert.equal(pickProvider(rows), 'claude');
  });

  it('returns each KNOWN_PROVIDERS value when it is the nearest good', () => {
    for (const provider of KNOWN_PROVIDERS) {
      assert.equal(pickProvider([{ tag: 'good', provider }]), provider);
    }
  });
});

describe('pickProvider — falls back to codex', () => {
  it('falls back when there is no tagged-good row', () => {
    const rows = [
      { tag: 'bad',  provider: 'copilot' },
      { tag: null,   provider: 'claude' },
    ];
    assert.equal(pickProvider(rows), FALLBACK);
  });

  it('falls back on an empty array', () => {
    assert.equal(pickProvider([]), FALLBACK);
  });

  it('falls back on non-array inputs', () => {
    assert.equal(pickProvider(null), FALLBACK);
    assert.equal(pickProvider(undefined), FALLBACK);
    assert.equal(pickProvider({}), FALLBACK);
    assert.equal(pickProvider('codex'), FALLBACK);
    assert.equal(pickProvider(42), FALLBACK);
  });

  it('falls back when the nearest good row names an unknown provider', () => {
    const rows = [{ tag: 'good', provider: 'gpt-4' }];
    assert.equal(pickProvider(rows), FALLBACK);
  });

  it('falls back when the nearest good row has a missing provider field', () => {
    const rows = [{ tag: 'good' }];
    assert.equal(pickProvider(rows), FALLBACK);
  });
});
