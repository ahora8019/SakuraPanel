CREATE TABLE rate_limit_buckets (key TEXT PRIMARY KEY, count INTEGER NOT NULL, reset_at INTEGER NOT NULL);
CREATE INDEX idx_rate_limit_buckets_reset_at ON rate_limit_buckets(reset_at);
