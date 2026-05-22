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
import * as copilot from './lib/providers/copilot.mjs';
import { pickProvider, KNOWN_PROVIDERS } from './lib/router.mjs';

// Subprocess adapters only. 'claude' is a routable provider but is delegated to
// at the do.md instruction layer via the Agent tool, not from this script.
const PROVIDERS = { codex, copilot };

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

// prepare: classify + retrieve + INSERT row (NULL result), emit JSON for do.md
// to branch on. All status output goes to stderr; stdout is JSON only so do.md
// can parse it cleanly even when migrations or bootstrap log during first run.
async function runPrepare(task, forcedProvider) {
  if (!task) {
    console.error('usage: metis prepare "<task>" [--provider <name>]');
    process.exit(1);
  }
  if (forcedProvider !== undefined && !KNOWN_PROVIDERS.has(forcedProvider)) {
    console.error(`metis: unknown provider '${forcedProvider}' (available: ${[...KNOWN_PROVIDERS].join(', ')})`);
    process.exit(1);
  }
  const metisDir = ensureMetisDir();
  const db = openDb(path.join(metisDir, 'metis.db'));
  // Retrieve BEFORE inserting the current row so the task cannot match itself.
  const past = findSimilar(db, task, 3);
  const { prompt, contextInjected } = buildPrompt(past, task);
  const providerName = forcedProvider ?? pickProvider(past);

  const id = insertDelegation(db, {
    ts: Math.floor(Date.now() / 1000),
    task,
    taskType: classifyTaskType(task),
    provider: providerName,
    contextInjected,
  });

  process.stdout.write(JSON.stringify({ rowId: Number(id), provider: providerName, prompt }) + '\n');
}

// delegate: subprocess path for codex/copilot. Reads the row's provider+prompt,
// spawns the adapter, writes the result. 'claude' is rejected — it belongs to
// the Agent-tool path in do.md.
async function runDelegate(rowIdArg) {
  if (!/^[1-9]\d*$/.test(rowIdArg ?? '')) {
    console.error('usage: metis delegate <rowId>');
    process.exit(1);
  }
  const rowId = parseInt(rowIdArg, 10);
  const metisDir = path.join(process.cwd(), '.metis');
  if (!existsSync(metisDir)) {
    console.error('metis: no .metis/ in this repo — run /metis:do first');
    process.exit(1);
  }
  const db = openDb(path.join(metisDir, 'metis.db'));
  const row = db
    .prepare('SELECT id, task, context_injected, provider FROM delegations WHERE id = ?')
    .get(rowId);
  if (!row) {
    console.error(`metis: no delegation with id ${rowId}`);
    process.exit(1);
  }
  const provider = PROVIDERS[row.provider];
  if (!provider) {
    console.error(
      `metis: delegate cannot run provider '${row.provider}' (subprocess path is ${Object.keys(PROVIDERS).join('/')} only)`
    );
    process.exit(1);
  }
  // Reconstruct prompt: when past work matched, context_injected === full prompt
  // (retrieval.mjs:65). When no match, context_injected is NULL and task is the
  // raw prompt.
  const prompt = row.context_injected ?? row.task;

  // Claude Code plugin runtime does not expose an AbortSignal, so wire SIGINT
  // into an AbortController so Ctrl-C kills the provider subprocess cleanly.
  const controller = new AbortController();
  process.once('SIGINT', () => controller.abort());

  try {
    const result = await provider.delegate({ prompt, signal: controller.signal });
    updateResult(db, rowId, result);
    process.stdout.write(result);
  } catch (err) {
    // AbortSignal failure contract: row stays as-is (NULL result), visible for retry/delete.
    console.error(`metis: delegation failed (row ${rowId} left with NULL result): ${err.message}`);
    process.exit(1);
  }
}

// record: UPDATE result only. Used by do.md after the Agent tool returns for
// the Claude branch.
function runRecord(rowIdArg, result) {
  if (!/^[1-9]\d*$/.test(rowIdArg ?? '')) {
    console.error('usage: metis record <rowId> "<result>"');
    process.exit(1);
  }
  if (result === undefined) {
    console.error('usage: metis record <rowId> "<result>"');
    process.exit(1);
  }
  const rowId = parseInt(rowIdArg, 10);
  const metisDir = path.join(process.cwd(), '.metis');
  if (!existsSync(metisDir)) {
    console.error('metis: no .metis/ in this repo');
    process.exit(1);
  }
  const db = openDb(path.join(metisDir, 'metis.db'));
  const row = db.prepare('SELECT id FROM delegations WHERE id = ?').get(rowId);
  if (!row) {
    console.error(`metis: no delegation with id ${rowId}`);
    process.exit(1);
  }
  updateResult(db, rowId, result);
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
    if (!/^[1-9]\d*$/.test(targetId)) {
      console.error('usage: metis tag <good|bad> [id]');
      process.exit(1);
    }
    id = tagById(db, parseInt(targetId, 10), tag);
    if (id === null) {
      console.error(`metis: no delegation with id ${targetId}`);
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
if (command === 'prepare') {
  const providerFlagIdx = process.argv.indexOf('--provider');
  const forcedProvider = providerFlagIdx !== -1 ? process.argv[providerFlagIdx + 1] : undefined;
  if (providerFlagIdx !== -1 && (forcedProvider === undefined || forcedProvider.startsWith('--'))) {
    console.error('metis: --provider requires a value');
    process.exit(1);
  }
  await runPrepare(process.argv[3], forcedProvider);
} else if (command === 'delegate') {
  await runDelegate(process.argv[3]);
} else if (command === 'record') {
  runRecord(process.argv[3], process.argv[4]);
} else if (command === 'tag') {
  runTag(process.argv[3], process.argv[4]);
} else if (command === 'status') {
  runStatus();
} else {
  console.error('usage: metis <prepare|delegate|record|tag|status> ...');
  process.exit(1);
}
