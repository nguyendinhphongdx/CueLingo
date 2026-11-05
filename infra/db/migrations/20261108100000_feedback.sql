-- migrate:up
-- Tester feedback: only what the person typed plus the app and OS version. No transcript, audio or token
-- column exists, so none can be stored. Deleting the account deletes the feedback.

CREATE TABLE feedback (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth_user (id) ON DELETE CASCADE,
  kind        text NOT NULL CHECK (kind IN ('bug', 'idea')),
  message     text NOT NULL CHECK (char_length(message) BETWEEN 1 AND 2000),
  client      text NOT NULL CHECK (client IN ('desktop', 'web')),
  app_version text NOT NULL CHECK (char_length(app_version) <= 40),
  os          text NOT NULL CHECK (char_length(os) <= 80),
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX feedback_user_created_idx ON feedback (user_id, created_at);

-- The beta numbers (time to first caption, D1, D7) look events up by type and person.
CREATE INDEX events_type_user_at_idx ON events (type, user_id, at);

-- migrate:down
DROP INDEX IF EXISTS events_type_user_at_idx;
DROP TABLE IF EXISTS feedback;
