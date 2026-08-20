import { existsSync, mkdirSync, writeFileSync, readFileSync, unlinkSync, rmdirSync } from 'node:fs';
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
import * as claude from './lib/providers/claude.mjs';
import { pickProvider, KNOWN_PROVIDERS } from './lib/router.mjs';
import { classifyTaskType } from './lib/classify.mjs';

// Claude Code's do.md keeps its native Agent branch for Claude. Direct CLI and
// other plugin hosts use these subprocess adapters for all three providers.
const PROVIDERS = { codex, copilot, claude };

function ensureMetisDir() {
  const metisDir = path.join(process.cwd(), '.metis');
  if (!existsSync(metisDir)) {
    mkdirSync(metisDir, { recursive: true });
    writeFileSync(path.join(metisDir, '.gitignore'), '*\n!.gitignore\n');
  }
  return metisDir;
}

// Read a payload (task or result) from a file written by do.md's Write-tool
// pre-step. The file path never contains user/subagent content — only the
// payload does — so reading it via fs (not via the shell) eliminates the
// shell-interpolation injection surface. Unlinks best-effort after read.
function readPayloadFile(p) {
  let content;
  let readError;
  try {
    content = readFileSync(p, 'utf8');
  } catch (err) {
    readError = err;
  }
  try { unlinkSync(p); } catch { /* best-effort cleanup */ }
  // do.md creates a per-invocation directory via `mktemp -d` and writes the
  // payload inside it. After unlinking the file, rmdir the parent so empty
  // handoff dirs don't accumulate in $TMPDIR. Gate on the mktemp -d basename
  // pattern so we don't touch the parent dir when a direct-CLI user passes
  // `--from-file /some/dir/file.txt` from their own filesystem. rmdir only
  // succeeds on an empty dir, so even with a matching pattern this no-ops if
  // anything else lives there.
  const parent = path.dirname(p);
  if (/^metis-(task|result-\d+)\.[A-Za-z0-9]{6,}$/.test(path.basename(parent))) {
    try { rmdirSync(parent); } catch { /* best-effort */ }
  }
  if (readError) {
    console.error(`metis: cannot read ${p}: ${readError.message}`);
    process.exit(1);
  }
  return content;
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

// Compatibility path for direct CLI callers. /metis:do uses the split
// prepare/delegate/record flow so Claude Code can keep its native Agent branch.
async function runDo(task, forcedProvider) {
  if (!task) {
    console.error('usage: metis do "<task>" [--provider <name>]');
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
  const routedProvider = pickProvider(past);
  const providerName = forcedProvider ?? routedProvider;
  const provider = PROVIDERS[providerName];
  if (!provider) {
    console.error(`metis: provider '${providerName}' is unavailable in the direct CLI`);
    process.exit(1);
  }

  // Claude Code plugin runtime does not expose an AbortSignal, so wire SIGINT
  // into an AbortController so Ctrl-C kills the provider subprocess cleanly.
  const controller = new AbortController();
  process.once('SIGINT', () => controller.abort());

  let id;
  try {
    id = insertDelegation(db, {
      ts: Math.floor(Date.now() / 1000),
      task,
      taskType: classifyTaskType(task),
      provider: providerName,
      contextInjected,
    });
    const result = await provider.delegate({ prompt, signal: controller.signal });
    updateResult(db, id, result);
    process.stdout.write(result);
  } catch (err) {
    // AbortSignal failure contract: row stays as-is (NULL result), visible for retry/delete.
    const rowNote = id != null ? ` (row ${id} left with NULL result)` : '';
    console.error(`metis: delegation failed${rowNote}: ${err.message}`);
    process.exit(1);
  }
}

// delegate: subprocess path for Codex, Copilot, or non-Claude hosts invoking
// Claude. Reads the row's provider+prompt, spawns the adapter, writes the result.
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
if (command === 'do') {
  // Accepts: <task> [--provider <name>]
  const argv = process.argv.slice(3);
  let task;
  let forcedProvider;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--provider') {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith('--')) {
        console.error('metis: --provider requires a value');
        process.exit(1);
      }
      forcedProvider = value;
      i++;
    } else if (task === undefined) {
      task = a;
    } else {
      console.error(`metis: unexpected argument '${a}'`);
      process.exit(1);
    }
  }
  await runDo(task, forcedProvider);
} else if (command === 'prepare') {
  // Accepts: [<task>] [--provider <name>] [--from-file <path>]
  // <task> and --from-file are mutually exclusive. --from-file is the safe
  // path used by do.md to avoid shell interpolation of untrusted payloads.
  const argv = process.argv.slice(3);
  let positionalTask;
  let forcedProvider;
  let fromFile;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--provider' || a === '--from-file') {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith('--')) {
        console.error(`metis: ${a} requires a value`);
        process.exit(1);
      }
      if (a === '--provider') forcedProvider = value;
      else fromFile = value;
      i++;
    } else if (positionalTask === undefined) {
      positionalTask = a;
    } else {
      console.error(`metis: unexpected argument '${a}'`);
      process.exit(1);
    }
  }
  if (fromFile !== undefined && positionalTask !== undefined) {
    console.error('metis: cannot use both positional task and --from-file');
    process.exit(1);
  }
  const task = fromFile !== undefined ? readPayloadFile(fromFile) : positionalTask;
  await runPrepare(task, forcedProvider);
} else if (command === 'delegate') {
  await runDelegate(process.argv[3]);
} else if (command === 'record') {
  // Accepts: <rowId> [<result>] [--from-file <path>]
  // <result> and --from-file are mutually exclusive. --from-file is the safe
  // path used by do.md after the Agent tool returns.
  const argv = process.argv.slice(3);
  let rowIdArg;
  let positionalResult;
  let fromFile;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--from-file') {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith('--')) {
        console.error('metis: --from-file requires a value');
        process.exit(1);
      }
      fromFile = value;
      i++;
    } else if (rowIdArg === undefined) {
      rowIdArg = a;
    } else if (positionalResult === undefined) {
      positionalResult = a;
    } else {
      console.error(`metis: unexpected argument '${a}'`);
      process.exit(1);
    }
  }
  if (fromFile !== undefined && positionalResult !== undefined) {
    console.error('metis: cannot use both positional result and --from-file');
    process.exit(1);
  }
  const result = fromFile !== undefined ? readPayloadFile(fromFile) : positionalResult;
  runRecord(rowIdArg, result);
} else if (command === 'tag') {
  runTag(process.argv[3], process.argv[4]);
} else if (command === 'status') {
  runStatus();
} else {
  console.error('usage: metis <do|prepare|delegate|record|tag|status> ...');
  process.exit(1);
}
