CREATE INDEX idx_endpoint_group_members_endpoint_id ON endpoint_group_members(endpoint_id);
CREATE INDEX idx_configs_user_id ON configs(user_id);
CREATE INDEX idx_configs_endpoint_id ON configs(endpoint_id);
CREATE INDEX idx_configs_template_id ON configs(template_id);
CREATE INDEX idx_config_versions_config_id ON config_versions(config_id);
CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscription_versions_subscription_id ON subscription_versions(subscription_id);
CREATE INDEX idx_subscription_versions_created_at ON subscription_versions(created_at);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource, resource_id);
