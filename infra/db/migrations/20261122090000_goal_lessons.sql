-- migrate:up
-- Goal lessons (ADR 0025): goals a person picked, AI lesson content shared between people, and what each
-- person did with it. Only additive: nothing that exists is changed except the metric list of usage_counters.
CREATE TABLE learning_goals (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE,
  goal_key    text NOT NULL,                       -- catalog key in @cuelingo/shared
  language    text NOT NULL,
  level       text NOT NULL CHECK (level IN ('a2', 'b1', 'b2', 'c1')),
  deadline    date,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, goal_key, language)
);

-- Shared AI content: no user_id and no user data (ADR 0025). Not personal data, so DELETE /v1/me/data leaves it.
CREATE TABLE lesson_contents (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_key        text NOT NULL,
  lesson_key      text NOT NULL,
  level           text NOT NULL CHECK (level IN ('a2', 'b1', 'b2', 'c1')),
  language        text NOT NULL,
  revision        smallint NOT NULL DEFAULT 1,
  prompt_version  text NOT NULL,
  model           text NOT NULL,
  content         jsonb NOT NULL,
  status          text NOT NULL DEFAULT 'live' CHECK (status IN ('live', 'retired')),
  created_at      timestamptz NOT NULL DEFAULT now()
);
-- One live version per (goal, lesson, level, language): two requests racing to make it cannot both win.
CREATE UNIQUE INDEX lesson_contents_live_idx
  ON lesson_contents (goal_key, lesson_key, level, language) WHERE status = 'live';

-- One row per lesson a person opened: pins the content version and holds the personal part.
CREATE TABLE goal_lessons (
  goal_id                  uuid NOT NULL REFERENCES learning_goals(id) ON DELETE CASCADE,
  user_id                  uuid NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE,
  lesson_key               text NOT NULL,
  content_id               uuid NOT NULL REFERENCES lesson_contents(id),
  personal                 jsonb,                  -- examples built from the person's terms
  personal_prompt_version  text,
  best_correct             smallint CHECK (best_correct BETWEEN 0 AND 6),
  attempts                 integer NOT NULL DEFAULT 0,
  done_at                  timestamptz,
  opened_at                timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (goal_id, lesson_key)
);
CREATE INDEX goal_lessons_user_idx ON goal_lessons (user_id);
CREATE INDEX goal_lessons_content_idx ON goal_lessons (content_id);

CREATE TABLE lesson_reports (
  content_id  uuid NOT NULL REFERENCES lesson_contents(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE,
  reason      text NOT NULL CHECK (reason IN ('english', 'vietnamese', 'off_goal', 'level', 'other')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (content_id, user_id)
);

ALTER TABLE usage_counters DROP CONSTRAINT usage_counters_metric_check;
ALTER TABLE usage_counters ADD CONSTRAINT usage_counters_metric_check CHECK (metric IN (
  'translation_ms', 'cloud_stt_ms', 'debriefs', 'assist_daily', 'agent_messages',
  'lessons_daily', 'lesson_practice_daily'));

-- migrate:down
DELETE FROM usage_counters WHERE metric IN ('lessons_daily', 'lesson_practice_daily');
ALTER TABLE usage_counters DROP CONSTRAINT usage_counters_metric_check;
ALTER TABLE usage_counters ADD CONSTRAINT usage_counters_metric_check CHECK (metric IN (
  'translation_ms', 'cloud_stt_ms', 'debriefs', 'assist_daily', 'agent_messages'));
DROP TABLE IF EXISTS lesson_reports;
DROP TABLE IF EXISTS goal_lessons;
DROP TABLE IF EXISTS lesson_contents;
DROP TABLE IF EXISTS learning_goals;
