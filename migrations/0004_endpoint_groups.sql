CREATE TABLE endpoint_groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE endpoint_group_members (
  group_id TEXT NOT NULL,
  endpoint_id TEXT NOT NULL,
  PRIMARY KEY (group_id, endpoint_id),
  FOREIGN KEY (group_id) REFERENCES endpoint_groups(id) ON DELETE CASCADE,
  FOREIGN KEY (endpoint_id) REFERENCES endpoints(id) ON DELETE CASCADE
);