CREATE TABLE rate_limit_buckets (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL CHECK (count > 0),
  reset_at INTEGER NOT NULL CHECK (reset_at > 0)
);
CREATE INDEX idx_rate_limit_buckets_reset_at ON rate_limit_buckets(reset_at);
