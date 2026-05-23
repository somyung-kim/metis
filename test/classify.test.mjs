import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { classifyTaskType } from '../scripts/lib/classify.mjs';

describe('classifyTaskType — fix bucket', () => {
  for (const word of ['fix', 'bug', 'broken', 'error', 'crash', 'fails', 'fail', 'failing']) {
    it(`classifies "${word}" as fix`, () => {
      assert.equal(classifyTaskType(`please ${word} the thing`), 'fix');
    });
  }

  it('is case-insensitive', () => {
    assert.equal(classifyTaskType('FIX the BUG'), 'fix');
  });
});

describe('classifyTaskType — review bucket', () => {
  for (const word of ['review', 'check', 'audit', 'inspect']) {
    it(`classifies "${word}" as review`, () => {
      assert.equal(classifyTaskType(`please ${word} the module`), 'review');
    });
  }
});

describe('classifyTaskType — refactor bucket', () => {
  for (const word of ['refactor', 'cleanup', 'clean up', 'simplify', 'restructure']) {
    it(`classifies "${word}" as refactor`, () => {
      assert.equal(classifyTaskType(`please ${word} this code`), 'refactor');
    });
  }
});

describe('classifyTaskType — explain bucket', () => {
  it('classifies "explain" as explain', () => {
    assert.equal(classifyTaskType('explain the auth flow'), 'explain');
  });

  for (const phrase of ['what does', 'how does', 'why does', 'describe']) {
    it(`classifies "${phrase}" as explain`, () => {
      assert.equal(classifyTaskType(`${phrase} this function do`), 'explain');
    });
  }
});

describe('classifyTaskType — default to feature', () => {
  it('returns "feature" when no keyword matches', () => {
    assert.equal(classifyTaskType('add a dashboard for sales metrics'), 'feature');
  });

  it('returns "feature" for an empty string', () => {
    assert.equal(classifyTaskType(''), 'feature');
  });

  it('respects word boundaries — "prefix" does not contain a fix-keyword', () => {
    assert.equal(classifyTaskType('add the prefix handler'), 'feature');
  });

  it('respects word boundaries — "checkout" does not contain a review-keyword', () => {
    assert.equal(classifyTaskType('build the checkout page'), 'feature');
  });
});

describe('classifyTaskType — first-match-wins ordering', () => {
  it('fix beats refactor when both keywords are present', () => {
    assert.equal(classifyTaskType('fix and refactor the parser'), 'fix');
  });

  it('fix beats review when both keywords are present', () => {
    assert.equal(classifyTaskType('review and fix the regression'), 'fix');
  });

  it('review beats refactor when both keywords are present', () => {
    assert.equal(classifyTaskType('review and refactor the module'), 'review');
  });

  it('refactor beats explain when both keywords are present', () => {
    assert.equal(classifyTaskType('refactor and explain the parser'), 'refactor');
  });
});
