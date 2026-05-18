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
