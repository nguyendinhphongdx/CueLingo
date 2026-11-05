-- migrate:up
-- Finds messages left `streaming` (a turn that died with its process) without scanning every message.
CREATE INDEX agent_messages_streaming_idx ON agent_messages (status) WHERE status = 'streaming';

-- migrate:down
DROP INDEX IF EXISTS agent_messages_streaming_idx;
