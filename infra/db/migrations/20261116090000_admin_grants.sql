-- migrate:up
-- A plan an admin grants is recorded as a paid order of 0 dong with provider 'admin' (owner decision
-- 2026-11-16), so the user's history and the admin page show it. `provider` has no CHECK, so only the amount
-- rule changes.
ALTER TABLE billing_orders DROP CONSTRAINT billing_orders_amount_check;
ALTER TABLE billing_orders ADD CONSTRAINT billing_orders_amount_check CHECK (amount >= 0);

-- migrate:down
-- A 0 dong order cannot exist under the old rule, so the grants are removed first.
DELETE FROM billing_orders WHERE amount = 0;
ALTER TABLE billing_orders DROP CONSTRAINT billing_orders_amount_check;
ALTER TABLE billing_orders ADD CONSTRAINT billing_orders_amount_check CHECK (amount > 0);
