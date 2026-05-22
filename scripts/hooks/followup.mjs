import { existsSync } from 'node:fs';
import path from 'node:path';
import { openDb, appendFollowup } from '../lib/memory.mjs';

const chunks = [];
for await (const chunk of process.stdin) chunks.push(chunk);

let input;
try {
  input = JSON.parse(Buffer.concat(chunks).toString());
} catch {
  process.exit(0);
}

const { prompt, cwd } = input;

// Skip metis commands — not followup signals, and must not consume a slot.
if (typeof prompt === 'string' && prompt.trimStart().startsWith('/metis:')) process.exit(0);

const dbPath = path.join(cwd, '.metis', 'metis.db');
if (!existsSync(dbPath)) process.exit(0);

const db = openDb(dbPath);
appendFollowup(db, prompt ?? '');
process.exit(0);
