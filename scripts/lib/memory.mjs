import Database from 'better-sqlite3';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(__dirname, 'migrations');
const RESULT_MAX_CHARS = 4096; // ~4KB per PRD schema

export function openDb(dbPath) {
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 3000');
  db.pragma('foreign_keys = ON');
  process.on('exit', () => db.close());
  migrate(db);
  return db;
}

function migrate(db) {
  const current = db.pragma('user_version', { simple: true });
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => /^\d+_.*\.sql$/.test(f))
    .sort();
  for (const f of files) {
    const version = parseInt(f.split('_')[0], 10);
    if (version > current) {
      db.exec(readFileSync(path.join(MIGRATIONS_DIR, f), 'utf8'));
    }
  }
}

export function insertDelegation(db, { ts, task, taskType, provider, contextInjected }) {
  const stmt = db.prepare(
    `INSERT INTO delegations (ts, task, task_type, provider, context_injected, result, tag)
     VALUES (?, ?, ?, ?, ?, NULL, NULL)`
  );
  const info = stmt.run(ts, task, taskType, provider, contextInjected ?? null);
  return info.lastInsertRowid;
}

export function updateResult(db, id, result) {
  const truncated =
    result.length > RESULT_MAX_CHARS ? result.slice(0, RESULT_MAX_CHARS) : result;
  db.prepare('UPDATE delegations SET result = ? WHERE id = ?').run(truncated, id);
}

export function tagLatest(db, tag) {
  const row = db.prepare('SELECT id FROM delegations ORDER BY id DESC LIMIT 1').get();
  if (!row) return null;
  db.prepare('UPDATE delegations SET tag = ? WHERE id = ?').run(tag, row.id);
  return row.id;
}

export function tagById(db, id, tag) {
  const info = db.prepare('UPDATE delegations SET tag = ? WHERE id = ?').run(tag, id);
  return info.changes > 0 ? id : null;
}

// Sanitize task text for an FTS5 MATCH: quote each alnum token as a literal
// and OR-join (recall-oriented). Quoting neutralizes FTS operators/special
// chars, so the produced query can never be a syntax error. No tokens -> null.
function ftsQuery(taskText) {
  const toks = String(taskText).toLowerCase().match(/[a-z0-9]+/g);
  if (!toks || toks.length === 0) return null;
  return toks.map((t) => `"${t}"`).join(' OR ');
}

// Caller runs this BEFORE inserting the current delegation, so the current
// task cannot match itself (no self-match exclusion needed).
// Excludes rows with NULL result: aborted/failed past delegations have no
// useful output to inject and would otherwise waste a retrieval slot.
export function findSimilar(db, taskText, limit = 3) {
  const q = ftsQuery(taskText);
  if (!q) return [];
  return db
    .prepare(
      `SELECT d.* FROM delegations d
       JOIN delegations_fts f ON d.id = f.rowid
       WHERE delegations_fts MATCH ?
         AND d.result IS NOT NULL
       ORDER BY bm25(delegations_fts) ASC
       LIMIT ?`
    )
    .all(q, limit);
}

export function lastDelegations(db, n = 10) {
  return db
    .prepare(
      'SELECT id, ts, task, task_type, provider, tag FROM delegations ORDER BY id DESC LIMIT ?'
    )
    .all(n);
}

export function weeklySummary(db, sinceTs) {
  const row = db
    .prepare(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN tag IS NOT NULL THEN 1 ELSE 0 END) AS tagged,
         SUM(CASE WHEN tag = 'good' THEN 1 ELSE 0 END) AS good,
         SUM(CASE WHEN tag = 'bad'  THEN 1 ELSE 0 END) AS bad
       FROM delegations
       WHERE ts >= ?`
    )
    .get(sinceTs);
  // SUM() returns NULL when no rows match the WHERE; coerce the SUMs to 0.
  // COUNT(*) is already 0 in that case — the `|| 0` on `total` is for symmetry.
  const total = row.total || 0;
  const tagged = row.tagged || 0;
  const good = row.good || 0;
  const bad = row.bad || 0;
  return { total, tagged, good, bad, untagged: total - tagged };
}
