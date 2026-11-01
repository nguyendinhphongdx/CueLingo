-- migrate:up
-- Sign-in for the desktop app: a one-time code is minted from a web session and exchanged for a
-- long-lived device token. Only SHA-256 hashes are stored, so a leaked table cannot be replayed.
CREATE TABLE device_codes (
  code_hash   text PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE,
  expires_at  timestamptz NOT NULL,
  used_at     timestamptz
);

CREATE TABLE device_tokens (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE,
  token_hash    text NOT NULL UNIQUE,
  label         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  last_used_at  timestamptz,
  revoked_at    timestamptz
);
CREATE INDEX device_tokens_user_idx ON device_tokens (user_id);

-- migrate:down
DROP TABLE IF EXISTS device_tokens;
DROP TABLE IF EXISTS device_codes;
