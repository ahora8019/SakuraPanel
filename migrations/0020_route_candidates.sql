CREATE TABLE route_candidates (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL CHECK (length(label) BETWEEN 1 AND 120),
  protocol TEXT NOT NULL CHECK (length(protocol) BETWEEN 1 AND 32),
  region TEXT,
  compatible INTEGER NOT NULL DEFAULT 0 CHECK (compatible IN (0, 1)),
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_route_candidates_enabled
  ON route_candidates(enabled, updated_at DESC);
