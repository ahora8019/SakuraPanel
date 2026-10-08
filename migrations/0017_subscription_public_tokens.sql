-- Add opaque public subscription access tokens.
-- The raw token is never stored; only its SHA-256 digest is persisted.
ALTER TABLE subscriptions ADD COLUMN public_token_hash TEXT;
CREATE UNIQUE INDEX idx_subscriptions_public_token_hash
  ON subscriptions(public_token_hash)
  WHERE public_token_hash IS NOT NULL;
