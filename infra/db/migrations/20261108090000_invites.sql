-- migrate:up
-- Invite codes for the closed beta. Only the SHA-256 of a code is stored; the plain code is shown once when
-- the admin creates it. `used_count <= max_uses` is enforced here so two people redeeming the last use at
-- the same time cannot both win (the redeeming UPDATE also checks it).

CREATE TABLE invites (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code_hash   text NOT NULL UNIQUE,
  max_uses    integer NOT NULL DEFAULT 1 CHECK (max_uses > 0),
  used_count  integer NOT NULL DEFAULT 0 CHECK (used_count >= 0),
  expires_at  timestamptz NOT NULL,
  note        text CHECK (note IS NULL OR char_length(note) <= 100),
  created_by  uuid REFERENCES auth_user (id) ON DELETE SET NULL,
  revoked_at  timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT invites_used_within_max CHECK (used_count <= max_uses)
);

CREATE TABLE invite_redemptions (
  invite_id   uuid NOT NULL REFERENCES invites (id) ON DELETE CASCADE,
  user_id     uuid NOT NULL UNIQUE REFERENCES auth_user (id) ON DELETE CASCADE,
  redeemed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX invite_redemptions_invite_idx ON invite_redemptions (invite_id);

-- migrate:down
DROP TABLE IF EXISTS invite_redemptions;
DROP TABLE IF EXISTS invites;
