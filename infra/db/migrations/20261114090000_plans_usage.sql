-- migrate:up
-- Plan per user. No row = 'free', so existing users need no backfill. `set_by` records who changed it.
CREATE TABLE user_plans (
  user_id     uuid PRIMARY KEY REFERENCES auth_user(id) ON DELETE CASCADE,
  plan        text NOT NULL CHECK (plan IN ('free', 'pro', 'ultra')),
  set_by      uuid REFERENCES auth_user(id) ON DELETE SET NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Billing counters: numbers only, no content. Survives DELETE /v1/me/data (ADR 0022); cascades on account delete.
CREATE TABLE usage_counters (
  user_id       uuid NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE,
  period_start  timestamptz NOT NULL,
  metric        text NOT NULL CHECK (metric IN ('translation_ms', 'cloud_stt_ms', 'debriefs', 'assist_daily', 'agent_messages')),
  amount        bigint NOT NULL DEFAULT 0 CHECK (amount >= 0),
  PRIMARY KEY (user_id, period_start, metric)
);

-- Set when a session ended without a debrief because the monthly allowance was used up.
ALTER TABLE sessions ADD COLUMN debrief_skipped text CHECK (debrief_skipped = 'quota');

-- migrate:down
ALTER TABLE sessions DROP COLUMN IF EXISTS debrief_skipped;
DROP TABLE IF EXISTS usage_counters;
DROP TABLE IF EXISTS user_plans;
