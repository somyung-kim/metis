CREATE TABLE delegations (
  id               INTEGER PRIMARY KEY,
  ts               INTEGER NOT NULL,        -- unix timestamp
  task             TEXT    NOT NULL,        -- raw user request
  task_type        TEXT,                    -- 'review'|'fix'|'feature'|'refactor'|'explain'
  provider         TEXT    NOT NULL,        -- 'codex'|'copilot'
  context_injected TEXT,                    -- past delegations shown to provider (byte-for-byte)
  result           TEXT,                    -- provider output (truncated to ~4KB)
  tag              TEXT,                    -- 'good'|'bad'|NULL (untagged)
  followup_messages TEXT,                   -- next 1-3 user messages (passive, for v2 analysis)
  embedding        BLOB                     -- NULL in v1; populated by v1.1+ when sqlite-vec lands
);

CREATE VIRTUAL TABLE delegations_fts
  USING fts5(
    task,
    content='delegations',
    content_rowid='id',
    tokenize='porter'
  );

PRAGMA user_version = 1;
