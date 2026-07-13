-- Migration 0006: auto rent increment schedule + per-lease utility charges.
-- Run once in Supabase. Additive and idempotent.

-- Rent increment schedule on the lease (all nullable; no change to existing rows).
alter table public.leases add column if not exists increment_pct numeric(5,2);
alter table public.leases add column if not exists increment_months integer;
alter table public.leases add column if not exists last_revised_date date;

-- Recurring utility lines attached to a lease. "fixed" lines are auto-added on
-- top of the rent at charge generation; "metered" lines store the per-unit rate
-- for manual/metered billing.
create table if not exists public.lease_utilities (
  id uuid primary key default gen_random_uuid(),
  landlord_id uuid not null references public.landlords(id) on delete cascade,
  lease_id uuid not null references public.leases(id) on delete cascade,
  kind text not null,
  billing text not null default 'fixed' check (billing in ('metered','fixed')),
  rate numeric(12,2) not null default 0 check (rate >= 0),
  created_at timestamptz not null default now()
);

create index if not exists lease_utilities_landlord_idx on public.lease_utilities(landlord_id);
create index if not exists lease_utilities_lease_idx on public.lease_utilities(lease_id);

alter table public.lease_utilities enable row level security;
