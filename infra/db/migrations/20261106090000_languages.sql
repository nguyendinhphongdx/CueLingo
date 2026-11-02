-- migrate:up
-- Multi-language foundation (ADR 0013). Everything that already exists is English, so every new column
-- defaults to 'en' and behaviour does not change. A meeting has a language; what a person learns
-- (vocabulary, glossary, level) is kept per language.

ALTER TABLE sessions ADD COLUMN language text NOT NULL DEFAULT 'en';
-- Null: the segment is in the meeting's language. Set only when a meeting switches language part-way.
ALTER TABLE segments ADD COLUMN language text;

ALTER TABLE lexical_items ADD COLUMN language text NOT NULL DEFAULT 'en';
ALTER TABLE lexical_items DROP CONSTRAINT lexical_items_lemma_type_key;
CREATE UNIQUE INDEX lexical_items_language_lemma_type_idx ON lexical_items (language, lemma, type);

ALTER TABLE glossary_terms ADD COLUMN language text NOT NULL DEFAULT 'en';
DROP INDEX glossary_terms_user_term_idx;
CREATE UNIQUE INDEX glossary_terms_user_language_term_idx
  ON glossary_terms (user_id, language, lower(term));

-- Per person and language: how well they listen and how much help they want. Replaces the single
-- values on learner_profiles over time; those stay for now and are copied here as English.
CREATE TABLE learner_languages (
  user_id          uuid NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE,
  language         text NOT NULL,
  listening_level  text,
  assist_default   smallint NOT NULL DEFAULT 4,
  settings         jsonb NOT NULL DEFAULT '{}',
  created_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, language)
);

INSERT INTO learner_languages (user_id, language, listening_level, assist_default)
SELECT user_id, 'en', listening_level, assist_default FROM learner_profiles;

-- migrate:down
-- Other languages cannot exist in the old schema, so their learning data is removed first.
DROP TABLE IF EXISTS learner_languages;

DELETE FROM glossary_terms WHERE language <> 'en';
DROP INDEX IF EXISTS glossary_terms_user_language_term_idx;
CREATE UNIQUE INDEX glossary_terms_user_term_idx ON glossary_terms (user_id, lower(term));
ALTER TABLE glossary_terms DROP COLUMN language;

DELETE FROM user_lexicon WHERE item_id IN (SELECT id FROM lexical_items WHERE language <> 'en');
DELETE FROM lexical_items WHERE language <> 'en';
DROP INDEX IF EXISTS lexical_items_language_lemma_type_idx;
ALTER TABLE lexical_items ADD CONSTRAINT lexical_items_lemma_type_key UNIQUE (lemma, type);
ALTER TABLE lexical_items DROP COLUMN language;

ALTER TABLE segments DROP COLUMN language;
DELETE FROM sessions WHERE language <> 'en';
ALTER TABLE sessions DROP COLUMN language;
