import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { openDb, insertDelegation, updateResult, tagLatest, findSimilar } from './lib/memory.mjs';
import { buildPrompt } from './lib/retrieval.mjs';
import * as codex from './lib/providers/codex.mjs';

function classifyTaskType(task) {
  const t = task.toLowerCase();
  if (/\b(fix|bug|broken|error|crash|fails?|failing)\b/.test(t)) return 'fix';
  if (/\b(review|check|audit|inspect)\b/.test(t)) return 'review';
  if (/\b(refactor|clean ?up|simplify|restructure)\b/.test(t)) return 'refactor';
  if (/\b(explain|what does|how does|why does|describe)\b/.test(t)) return 'explain';
  return 'feature';
}

function ensureMetisDir() {
  const metisDir = path.join(process.cwd(), '.metis');
  if (!existsSync(metisDir)) {
    mkdirSync(metisDir, { recursive: true });
    writeFileSync(path.join(metisDir, '.gitignore'), '*\n!.gitignore\n');
  }
  return metisDir;
}

async function runDo(task) {
  if (!task) {
    console.error('usage: metis do "<task>"');
    process.exit(1);
  }
  const metisDir = ensureMetisDir();
  const db = openDb(path.join(metisDir, 'metis.db'));
  // Retrieve BEFORE inserting the current row so the task cannot match itself.
  const past = findSimilar(db, task, 3);
  const { prompt, contextInjected } = buildPrompt(past, task);
  const id = insertDelegation(db, {
    ts: Math.floor(Date.now() / 1000),
    task,
    taskType: classifyTaskType(task),
    provider: codex.name,
    contextInjected,
  });
  try {
    const result = await codex.delegate({ prompt, signal: undefined });
    updateResult(db, id, result);
    process.stdout.write(result);
  } catch (err) {
    // AbortSignal failure contract: row stays as-is (NULL result), visible for retry/delete.
    console.error(`metis: delegation failed (row ${id} left with NULL result): ${err.message}`);
    process.exit(1);
  }
}

function runTag(tag) {
  if (tag !== 'good' && tag !== 'bad') {
    console.error('usage: metis tag <good|bad>');
    process.exit(1);
  }
  const metisDir = path.join(process.cwd(), '.metis');
  if (!existsSync(metisDir)) {
    console.error('metis: no .metis/ in this repo yet — run /metis:do first');
    process.exit(1);
  }
  const db = openDb(path.join(metisDir, 'metis.db'));
  const id = tagLatest(db, tag);
  if (id === null) {
    console.error('metis: no delegations to tag');
    process.exit(1);
  }
  console.log(`metis: tagged delegation ${id} as ${tag}`);
}

const command = process.argv[2];
if (command === 'do') {
  await runDo(process.argv[3]);
} else if (command === 'tag') {
  runTag(process.argv[3]);
} else {
  console.error('usage: metis <do|tag> ...');
  process.exit(1);
}
