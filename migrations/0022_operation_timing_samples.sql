CREATE TABLE operation_timing_samples (
  id TEXT PRIMARY KEY,
  operation TEXT NOT NULL CHECK (operation IN ('config_generate', 'subscription_provision')),
  measured_at TEXT NOT NULL,
  duration_ms REAL NOT NULL CHECK (duration_ms >= 0)
);

CREATE INDEX idx_operation_timing_samples_measured
  ON operation_timing_samples(measured_at DESC);
CREATE INDEX idx_operation_timing_samples_operation_measured
  ON operation_timing_samples(operation, measured_at DESC);
