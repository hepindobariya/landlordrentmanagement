-- Migration 0005: rent charge coverage period (charge-period label).
-- Stores the date range each rent charge covers, derived at generation time
-- from the lease billing cycle + pre/post-paid mode. Powers the
-- "Rent for <period>" line on charge rows and receipts. Additive / nullable,
-- so existing charges and older API calls keep working. Safe to re-run.

alter table public.rent_charges
  add column if not exists period_start date;
alter table public.rent_charges
  add column if not exists period_end date;
