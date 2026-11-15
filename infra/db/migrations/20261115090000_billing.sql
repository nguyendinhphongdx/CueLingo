-- migrate:up
-- A paid plan ends; an admin-set plan does not unless the admin gives a date. Expiry is applied when the plan
-- is read (`expires_at <= now()` counts as free), so no background job is needed.
ALTER TABLE user_plans
  ADD COLUMN expires_at timestamptz,
  ADD COLUMN source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'payment'));

-- Order codes are the PayOS `orderCode`: a positive integer, unique, hard to guess by counting from zero.
CREATE SEQUENCE billing_order_code_seq START 1000000 MINVALUE 1000000 MAXVALUE 9999999 NO CYCLE;

-- One row per purchase attempt. Prices are copied in at creation. Holds no payer bank data.
-- Kept after DELETE /v1/me/data (ADR 0023); removed with the account.
CREATE TABLE billing_orders (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE,
  order_code        integer NOT NULL UNIQUE,
  provider          text NOT NULL,
  plan              text NOT NULL CHECK (plan IN ('pro', 'ultra')),
  period            text NOT NULL CHECK (period IN ('month', 'year')),
  amount            integer NOT NULL CHECK (amount > 0),
  status            text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'expired', 'cancelled')),
  provider_link_id  text UNIQUE,
  provider_ref      text,
  qr_code           text,
  checkout_url      text,
  expires_at        timestamptz NOT NULL,
  paid_at           timestamptz,
  plan_expires_at   timestamptz,
  checked_at        timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX billing_orders_user_created_idx ON billing_orders (user_id, created_at DESC);

-- migrate:down
DROP TABLE IF EXISTS billing_orders;
DROP SEQUENCE IF EXISTS billing_order_code_seq;
ALTER TABLE user_plans DROP COLUMN IF EXISTS source, DROP COLUMN IF EXISTS expires_at;
