CREATE UNIQUE INDEX idx_users_single_owner ON users(role) WHERE role = 'OWNER';
