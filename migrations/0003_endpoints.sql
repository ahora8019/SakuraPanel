CREATE TABLE endpoints (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  host TEXT NOT NULL,
  port INTEGER NOT NULL,
  transport TEXT NOT NULL,
  tls INTEGER NOT NULL DEFAULT 1,
  region TEXT,
  priority INTEGER NOT NULL DEFAULT 100,
  status TEXT NOT NULL DEFAULT 'PROVISIONING',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_endpoints_status ON endpoints(status);
CREATE INDEX idx_endpoints_region ON endpoints(region);