-- Remove the legacy external-endpoint model.
-- SakuraPanel is Cloudflare-native and does not require VPS endpoints.
PRAGMA defer_foreign_keys = ON;

CREATE TABLE configs_new (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  device_id TEXT,
  template_id TEXT NOT NULL,
  template_version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  expires_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (device_id) REFERENCES devices(id),
  FOREIGN KEY (template_id) REFERENCES templates(id)
);

INSERT INTO configs_new (
  id,user_id,device_id,template_id,template_version,status,expires_at,created_at,updated_at
)
SELECT
  id,user_id,device_id,template_id,COALESCE(template_version,1),status,expires_at,created_at,updated_at
FROM configs;

CREATE TABLE config_versions_new (
  id TEXT PRIMARY KEY,
  config_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (config_id, version),
  FOREIGN KEY (config_id) REFERENCES configs_new(id) ON DELETE CASCADE
);

INSERT INTO config_versions_new (id,config_id,version,payload,created_at)
SELECT id,config_id,version,payload,created_at FROM config_versions;

DROP TABLE config_versions;
DROP TABLE configs;

ALTER TABLE configs_new RENAME TO configs;
ALTER TABLE config_versions_new RENAME TO config_versions;

DROP INDEX IF EXISTS idx_endpoints_status;
DROP INDEX IF EXISTS idx_endpoints_region;
DROP INDEX IF EXISTS idx_endpoint_group_members_endpoint_id;
DROP INDEX IF EXISTS idx_endpoints_region_priority;
DROP INDEX IF EXISTS idx_endpoints_status_region_priority;

CREATE INDEX idx_configs_user_id ON configs(user_id);
CREATE INDEX idx_configs_template_id ON configs(template_id);
CREATE INDEX idx_configs_user_created_at ON configs(user_id, created_at DESC);
CREATE INDEX idx_configs_device_created_at ON configs(device_id, created_at DESC);
CREATE INDEX idx_config_versions_config_id ON config_versions(config_id);
CREATE INDEX idx_config_versions_config_version ON config_versions(config_id, version DESC);

DROP TABLE endpoint_health;
DROP TABLE endpoint_group_members;
DROP TABLE endpoint_groups;
DROP TABLE endpoints;

PRAGMA defer_foreign_keys = OFF;
