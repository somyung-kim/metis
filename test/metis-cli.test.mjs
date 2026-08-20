import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';

import Database from 'better-sqlite3';

const metisScript = new URL('../scripts/metis.mjs', import.meta.url).pathname;
const tempDirs = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function createFixture(claudeSource) {
  const root = mkdtempSync(path.join(os.tmpdir(), 'metis-cli-'));
  tempDirs.push(root);

  const binDir = path.join(root, 'bin');
  const projectDir = path.join(root, 'project');
  mkdirSync(binDir);
  mkdirSync(projectDir);

  const executable = path.join(binDir, 'claude');
  writeFileSync(executable, `#!/usr/bin/env node\n${claudeSource}\n`);
  chmodSync(executable, 0o755);

  return {
    root,
    projectDir,
    env: { ...process.env, PATH: `${binDir}${path.delimiter}${process.env.PATH}` },
  };
}

function runMetis(fixture, args) {
  return spawnSync(process.execPath, [metisScript, ...args], {
    cwd: fixture.projectDir,
    env: fixture.env,
    encoding: 'utf8',
  });
}

function getRow(projectDir, id) {
  const db = new Database(path.join(projectDir, '.metis', 'metis.db'), { readonly: true });
  try {
    return db.prepare('SELECT task, provider, result, tag FROM delegations WHERE id = ?').get(id);
  } finally {
    db.close();
  }
}

describe('Claude CLI delegation', () => {
  it('runs Claude directly and records its result', () => {
    const fixture = createFixture("process.stdout.write('direct claude result');");

    const result = runMetis(fixture, ['do', 'direct task', '--provider', 'claude']);

    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, 'direct claude result');
    assert.deepEqual(getRow(fixture.projectDir, 1), {
      task: 'direct task',
      provider: 'claude',
      result: 'direct claude result',
      tag: null,
    });
  });

  it('delegates a prepared Claude row and preserves the exact task', () => {
    const fixture = createFixture("process.stdout.write('prepared claude result');");
    const task = 'fix "$(echo not-run)" and `echo not-run`\nthen test it';
    const taskFile = path.join(fixture.root, 'task.txt');
    writeFileSync(taskFile, task);

    const prepared = runMetis(fixture, [
      'prepare', '--from-file', taskFile, '--provider', 'claude',
    ]);

    assert.equal(prepared.status, 0, prepared.stderr);
    assert.equal(existsSync(taskFile), false);
    const { rowId, provider } = JSON.parse(prepared.stdout);
    assert.equal(provider, 'claude');

    const delegated = runMetis(fixture, ['delegate', String(rowId)]);

    assert.equal(delegated.status, 0, delegated.stderr);
    assert.equal(delegated.stdout, 'prepared claude result');
    assert.deepEqual(getRow(fixture.projectDir, rowId), {
      task,
      provider: 'claude',
      result: 'prepared claude result',
      tag: null,
    });
  });

  it('leaves a prepared row result and tag null when Claude fails', () => {
    const fixture = createFixture(
      "process.stderr.write('provider failed'); process.exit(7);"
    );
    const prepared = runMetis(fixture, ['prepare', 'failing task', '--provider', 'claude']);
    assert.equal(prepared.status, 0, prepared.stderr);
    const { rowId } = JSON.parse(prepared.stdout);

    const delegated = runMetis(fixture, ['delegate', String(rowId)]);

    assert.equal(delegated.status, 1);
    assert.match(delegated.stderr, /claude exited 7: provider failed/);
    assert.deepEqual(getRow(fixture.projectDir, rowId), {
      task: 'failing task',
      provider: 'claude',
      result: null,
      tag: null,
    });
  });
});
