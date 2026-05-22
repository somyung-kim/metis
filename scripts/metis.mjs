import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  openDb,
  insertDelegation,
  updateResult,
  tagLatest,
  tagById,
  findSimilar,
  lastDelegations,
  weeklySummary,
} from './lib/memory.mjs';
import { buildPrompt } from './lib/retrieval.mjs';
import { formatStatus } from './lib/status.mjs';
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

function runTag(tag, targetId) {
  if (tag !== 'good' && tag !== 'bad') {
    console.error('usage: metis tag <good|bad> [id]');
    process.exit(1);
  }
  const metisDir = path.join(process.cwd(), '.metis');
  if (!existsSync(metisDir)) {
    console.error('metis: no .metis/ in this repo yet — run /metis:do first');
    process.exit(1);
  }
  const db = openDb(path.join(metisDir, 'metis.db'));
  let id;
  if (targetId !== undefined) {
    const numericId = Number(targetId);
    if (!Number.isInteger(numericId) || numericId <= 0) {
      console.error('usage: metis tag <good|bad> [id]');
      process.exit(1);
    }
    id = tagById(db, numericId, tag);
    if (id === null) {
      console.error(`metis: no delegation with id ${numericId}`);
      process.exit(1);
    }
  } else {
    id = tagLatest(db, tag);
    if (id === null) {
      console.error('metis: no delegations to tag');
      process.exit(1);
    }
  }
  console.log(`metis: tagged delegation ${id} as ${tag}`);
}

function runStatus() {
  const metisDir = path.join(process.cwd(), '.metis');
  const sinceTs = Math.floor(Date.now() / 1000) - 7 * 86400;
  let last = [];
  let summary = { total: 0, tagged: 0, good: 0, bad: 0, untagged: 0 };
  // Don't auto-create .metis/ from `status` — bootstrap is a `do`-flow side effect.
  if (existsSync(metisDir)) {
    const db = openDb(path.join(metisDir, 'metis.db'));
    last = lastDelegations(db, 10);
    summary = weeklySummary(db, sinceTs);
  }
  process.stdout.write(formatStatus({ last, summary }));
}

const command = process.argv[2];
if (command === 'do') {
  await runDo(process.argv[3]);
} else if (command === 'tag') {
  runTag(process.argv[3], process.argv[4]);
} else if (command === 'status') {
  runStatus();
} else {
  console.error('usage: metis <do|tag|status> ...');
  process.exit(1);
}
