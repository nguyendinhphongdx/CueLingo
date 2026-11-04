-- migrate:up
-- Speaker labels in transcripts. `speakers` already exists (init) but nothing wrote to it yet, so the
-- constraints below cannot clash with data. The unique index makes "upsert by (session, label)" safe when
-- two sentences of one meeting arrive at the same time. Old segments keep speaker_id NULL (no backfill).

CREATE UNIQUE INDEX speakers_session_label_idx ON speakers (session_id, label);
ALTER TABLE speakers
  ADD CONSTRAINT speakers_display_name_len CHECK (display_name IS NULL OR char_length(display_name) <= 40),
  ADD CONSTRAINT speakers_label_format CHECK (label ~ '^(me|speaker_[1-8])$');
-- Deleting a speaker (and the SET NULL on segments) and reading a transcript with names.
CREATE INDEX segments_speaker_idx ON segments (speaker_id);

-- migrate:down
DROP INDEX IF EXISTS segments_speaker_idx;
ALTER TABLE speakers
  DROP CONSTRAINT IF EXISTS speakers_label_format,
  DROP CONSTRAINT IF EXISTS speakers_display_name_len;
DROP INDEX IF EXISTS speakers_session_label_idx;
