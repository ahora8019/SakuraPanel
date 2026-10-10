CREATE TABLE route_health_samples (
  id TEXT PRIMARY KEY,
  route_id TEXT NOT NULL REFERENCES route_candidates(id) ON DELETE CASCADE,
  measured_at TEXT NOT NULL,
  healthy INTEGER NOT NULL CHECK (healthy IN (0, 1)),
  latency_ms REAL CHECK (latency_ms IS NULL OR latency_ms >= 0),
  error_rate REAL CHECK (error_rate IS NULL OR (error_rate >= 0 AND error_rate <= 1)),
  created_at TEXT NOT NULL
);

CREATE INDEX idx_route_health_samples_route_measured
  ON route_health_samples(route_id, measured_at DESC);
CREATE INDEX idx_route_health_samples_measured
  ON route_health_samples(measured_at DESC);
