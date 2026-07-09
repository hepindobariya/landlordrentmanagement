-- Migration 0001: payments ledger for rent charges.
-- Run this once in Supabase (SQL editor) before deploying the payments API.
-- Safe to re-run (idempotent).

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  landlord_id uuid not null references public.landlords(id) on delete cascade,
  rent_charge_id uuid not null references public.rent_charges(id) on delete cascade,
  lease_id uuid references public.leases(id) on delete set null,
  amount numeric(12,2) not null check (amount > 0),
  method text not null default 'cash'
    check (method in ('cash','upi','bank_transfer','card','other')),
  paid_date date not null default (now() at time zone 'utc')::date,
  reference text,
  note text,
  receipt_no text,
  created_at timestamptz not null default now()
);

create index if not exists payments_landlord_idx on public.payments(landlord_id);
create index if not exists payments_charge_idx on public.payments(rent_charge_id);
create index if not exists payments_lease_idx on public.payments(lease_id);

-- Enable RLS as a safety net. The backend uses the service role key (which
-- bypasses RLS), so app-level landlord_id scoping remains the primary guard.
alter table public.payments enable row level security;
