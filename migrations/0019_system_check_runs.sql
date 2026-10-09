CREATE TABLE system_check_runs (
  id TEXT PRIMARY KEY,
  scheduled_slot TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('running', 'passed', 'failed', 'unavailable')),
  started_at TEXT NOT NULL,
  completed_at TEXT,
  duration_ms REAL NOT NULL DEFAULT 0 CHECK (duration_ms >= 0),
  result_json TEXT NOT NULL DEFAULT '{}'
);

CREATE INDEX idx_system_check_runs_started_at
  ON system_check_runs(started_at DESC);

CREATE INDEX idx_system_check_runs_status_started_at
  ON system_check_runs(status, started_at DESC);
