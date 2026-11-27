-- migrate:up
-- Assistant asked during a meeting (ADR 0027). Only additive: nothing that exists is changed except the metric
-- list of usage_counters.
CREATE TABLE meeting_questions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE,
  session_id      uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  seq             integer NOT NULL,
  question        text NOT NULL CHECK (char_length(question) BETWEEN 1 AND 500),
  answer          text NOT NULL DEFAULT '' CHECK (char_length(answer) <= 6000),
  sources         jsonb NOT NULL DEFAULT '[]',
  status          text NOT NULL DEFAULT 'streaming'
                  CHECK (status IN ('streaming', 'complete', 'stopped', 'error')),
  prompt_version  text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, seq)
);
CREATE INDEX meeting_questions_user_idx ON meeting_questions (user_id, created_at);

-- A row means the person agreed; withdrawing deletes it.
CREATE TABLE meeting_assist_consents (
  user_id     uuid PRIMARY KEY REFERENCES auth_user(id) ON DELETE CASCADE,
  version     text NOT NULL,
  granted_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE usage_counters DROP CONSTRAINT usage_counters_metric_check;
ALTER TABLE usage_counters ADD CONSTRAINT usage_counters_metric_check CHECK (metric IN (
  'translation_ms', 'cloud_stt_ms', 'debriefs', 'assist_daily', 'agent_messages',
  'lessons_daily', 'lesson_practice_daily', 'meeting_ask_daily'));

-- migrate:down
DELETE FROM usage_counters WHERE metric = 'meeting_ask_daily';
ALTER TABLE usage_counters DROP CONSTRAINT usage_counters_metric_check;
ALTER TABLE usage_counters ADD CONSTRAINT usage_counters_metric_check CHECK (metric IN (
  'translation_ms', 'cloud_stt_ms', 'debriefs', 'assist_daily', 'agent_messages',
  'lessons_daily', 'lesson_practice_daily'));
DROP TABLE IF EXISTS meeting_assist_consents;
DROP TABLE IF EXISTS meeting_questions;
