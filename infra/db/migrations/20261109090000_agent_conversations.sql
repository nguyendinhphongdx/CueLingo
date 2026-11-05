-- migrate:up
-- AI assistant conversations (ADR 0018). One row per message; a message's cards and tool steps live in
-- `parts`. Everything is owned by a user and goes with the account. Soft delete hides a conversation at
-- once and retention removes it for good after 7 days (US-15).

CREATE TABLE agent_conversations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth_user (id) ON DELETE CASCADE,
  title       text NOT NULL DEFAULT '' CHECK (char_length(title) <= 120),
  language    text NOT NULL DEFAULT 'en',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz
);
CREATE INDEX agent_conversations_user_updated_idx
  ON agent_conversations (user_id, updated_at DESC) WHERE deleted_at IS NULL;

CREATE TABLE agent_messages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES agent_conversations (id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES auth_user (id) ON DELETE CASCADE,
  seq             integer NOT NULL,
  role            text NOT NULL CHECK (role IN ('user', 'assistant')),
  parts           jsonb NOT NULL DEFAULT '[]',
  status          text NOT NULL DEFAULT 'complete'
                  CHECK (status IN ('streaming', 'complete', 'stopped', 'error', 'limited')),
  prompt_version  text,
  input_tokens    integer,
  output_tokens   integer,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (conversation_id, seq)
);

-- The sentence a phrase was saved from when it did not come from a meeting segment (assistant chat).
ALTER TABLE user_lexicon ADD COLUMN context_text text CHECK (char_length(context_text) <= 500);

-- migrate:down
ALTER TABLE user_lexicon DROP COLUMN IF EXISTS context_text;
DROP TABLE IF EXISTS agent_messages;
DROP TABLE IF EXISTS agent_conversations;
