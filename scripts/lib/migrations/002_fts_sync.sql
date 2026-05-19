-- External-content FTS5 (delegations_fts, content='delegations') does NOT
-- auto-sync. 001 created the table but no triggers, so the index was never
-- populated. These triggers keep it in sync; the one-time rebuild backfills
-- the rows recorded before this migration. Wrapped in a transaction because
-- the migration runner does not wrap migrations: on failure the whole thing
-- rolls back (user_version stays 1) so the next open cleanly retries.
BEGIN;

CREATE TRIGGER delegations_ai AFTER INSERT ON delegations BEGIN
  INSERT INTO delegations_fts(rowid, task) VALUES (new.id, new.task);
END;

CREATE TRIGGER delegations_ad AFTER DELETE ON delegations BEGIN
  INSERT INTO delegations_fts(delegations_fts, rowid, task) VALUES('delete', old.id, old.task);
END;

-- AFTER UPDATE OF task (not bare AFTER UPDATE): the index depends only on
-- `task`, so only resync when `task` changes. Avoids pointless FTS churn on
-- every updateResult()/tagLatest() call (which touch result/tag, not task).
CREATE TRIGGER delegations_au AFTER UPDATE OF task ON delegations BEGIN
  INSERT INTO delegations_fts(delegations_fts, rowid, task) VALUES('delete', old.id, old.task);
  INSERT INTO delegations_fts(rowid, task) VALUES (new.id, new.task);
END;

-- one-time backfill of rows inserted before the triggers existed
INSERT INTO delegations_fts(delegations_fts) VALUES('rebuild');

PRAGMA user_version = 2;

COMMIT;
