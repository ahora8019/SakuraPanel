CREATE INDEX idx_endpoints_region_priority
  ON endpoints(region, priority, id);
CREATE INDEX idx_endpoints_status_region_priority
  ON endpoints(status, region, priority, id);
CREATE INDEX idx_devices_user_status_created_at
  ON devices(user_id, status, created_at);
CREATE INDEX idx_configs_user_created_at
  ON configs(user_id, created_at DESC);
CREATE INDEX idx_configs_device_created_at
  ON configs(device_id, created_at DESC);
CREATE INDEX idx_config_versions_config_version
  ON config_versions(config_id, version DESC);
CREATE INDEX idx_subscriptions_user_created_at
  ON subscriptions(user_id, created_at DESC);
CREATE INDEX idx_subscription_versions_subscription_version
  ON subscription_versions(subscription_id, version DESC);
CREATE INDEX idx_audit_logs_actor_created_at
  ON audit_logs(actor_id, created_at DESC);
CREATE INDEX idx_audit_logs_resource_created_at
  ON audit_logs(resource, resource_id, created_at DESC);
