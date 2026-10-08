ALTER TABLE configs ADD COLUMN published_version INTEGER NOT NULL DEFAULT 1;

CREATE TABLE config_releases (
  id TEXT PRIMARY KEY,
  config_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  status TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  published_at TEXT,
  rolled_back_at TEXT,
  UNIQUE (config_id, version),
  FOREIGN KEY (config_id) REFERENCES configs(id) ON DELETE CASCADE
);

CREATE INDEX idx_config_releases_config_created_at ON config_releases(config_id, created_at DESC);
CREATE INDEX idx_config_releases_status ON config_releases(config_id, status);
