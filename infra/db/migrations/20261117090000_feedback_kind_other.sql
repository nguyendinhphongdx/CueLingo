-- migrate:up
-- Third feedback kind, "other". Additive: existing rows keep 'bug' / 'idea'.
ALTER TABLE feedback DROP CONSTRAINT feedback_kind_check;
ALTER TABLE feedback ADD CONSTRAINT feedback_kind_check CHECK (kind IN ('bug', 'idea', 'other'));

-- migrate:down
DELETE FROM feedback WHERE kind = 'other';
ALTER TABLE feedback DROP CONSTRAINT feedback_kind_check;
ALTER TABLE feedback ADD CONSTRAINT feedback_kind_check CHECK (kind IN ('bug', 'idea'));
