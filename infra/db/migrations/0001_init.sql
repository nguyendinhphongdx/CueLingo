-- Initial schema for the MVP. Design: docs/02-architecture/data-model.md
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE users (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email            text UNIQUE NOT NULL,
  name             text,
  native_lang      text NOT NULL DEFAULT 'vi',
  target_lang      text NOT NULL DEFAULT 'en',
  role             text,
  goals            jsonb NOT NULL DEFAULT '{}',
  listening_level  text,                          -- A2..C1 estimate
  assist_default   smallint NOT NULL DEFAULT 4,
  settings         jsonb NOT NULL DEFAULT '{}',
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE sessions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title            text,
  started_at       timestamptz NOT NULL DEFAULT now(),
  ended_at         timestamptz,
  assist_level     smallint NOT NULL,
  stt_source       text NOT NULL DEFAULT 'local',  -- local | cloud
  audio_retention  boolean NOT NULL DEFAULT false,
  consent          jsonb NOT NULL DEFAULT '{}',
  status           text NOT NULL DEFAULT 'live',   -- live | ended | debriefed | deleted
  cost_usd         numeric(10, 4) NOT NULL DEFAULT 0
);

CREATE TABLE speakers (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id       uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  label            text NOT NULL,                  -- "me", "speaker_1", ...
  display_name     text
);

CREATE TABLE segments (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id       uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  speaker_id       uuid REFERENCES speakers(id) ON DELETE SET NULL,
  source           text NOT NULL,                  -- mic | system
  start_ms         integer NOT NULL,
  end_ms           integer NOT NULL,
  text_en          text NOT NULL,
  text_vi          text,
  words            jsonb,                          -- [{w, startMs, endMs, conf}]
  confidence       real,
  audio_key        text,
  embedding        vector(1024)
);
CREATE INDEX segments_session_idx ON segments (session_id, start_ms);

CREATE TABLE events (
  id               uuid PRIMARY KEY,               -- client-generated, idempotent
  user_id          uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id       uuid REFERENCES sessions(id) ON DELETE CASCADE,
  segment_id       uuid REFERENCES segments(id) ON DELETE SET NULL,
  type             text NOT NULL,
  payload          jsonb NOT NULL DEFAULT '{}',
  latency_ms       integer,
  cost_usd         numeric(10, 6),
  at               timestamptz NOT NULL
);
CREATE INDEX events_user_at_idx ON events (user_id, at);

CREATE TABLE glossary_terms (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  term             text NOT NULL,
  translation      text,
  note             text
);

CREATE TABLE lexical_items (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lemma            text NOT NULL,
  type             text NOT NULL,                  -- word | phrase | idiom
  cefr             text,
  UNIQUE (lemma, type)
);

CREATE TABLE user_lexicon (
  user_id                  uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id                  uuid NOT NULL REFERENCES lexical_items(id),
  receptive_fsrs           jsonb,
  productive_fsrs          jsonb,
  seen_count               integer NOT NULL DEFAULT 0,
  lookup_count             integer NOT NULL DEFAULT 0,
  first_context_segment_id uuid REFERENCES segments(id) ON DELETE SET NULL,
  meaning_vi               text,
  stage                    text NOT NULL DEFAULT 'recognize', -- recognize | understand | use_with_hint | use
  in_review                boolean NOT NULL DEFAULT false,
  PRIMARY KEY (user_id, item_id)
);

CREATE TABLE debriefs (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id          uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  version             integer NOT NULL DEFAULT 1,
  summary             jsonb NOT NULL,
  action_items        jsonb NOT NULL DEFAULT '[]',
  hard_segment_ids    uuid[] NOT NULL DEFAULT '{}',
  phrase_suggestions  jsonb NOT NULL DEFAULT '[]',
  rephrase            jsonb NOT NULL DEFAULT '[]',
  comprehension_pct   real,
  prompt_version      text NOT NULL,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE review_logs (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id          uuid NOT NULL REFERENCES lexical_items(id),
  exercise_type    text NOT NULL,                  -- listen_choose | produce | cloze
  rating           smallint NOT NULL,              -- FSRS: 1 again .. 4 easy
  response_ms      integer,
  at               timestamptz NOT NULL DEFAULT now()
);
