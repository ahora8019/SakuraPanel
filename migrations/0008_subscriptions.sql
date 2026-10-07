CREATE TABLE subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  expires_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE subscription_versions (
  id TEXT PRIMARY KEY,
  subscription_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  config_ids_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (subscription_id, version),
  FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE CASCADE
);