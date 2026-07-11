-- Migration 0004: lease final settlement / archive (Batch 10).
-- Captures the closeout details when a lease ends: how much of the deposit was
-- returned, the settlement date, and free-text notes. All columns are nullable
-- and additive, so existing leases and older API calls keep working. The
-- "ended" status + these fields power the Archived leases view.

alter table public.leases
  add column if not exists deposit_returned numeric(12,2);
alter table public.leases
  add column if not exists final_settlement_date date;
alter table public.leases
  add column if not exists settlement_notes text;
