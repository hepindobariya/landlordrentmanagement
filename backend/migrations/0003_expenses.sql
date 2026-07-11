-- Migration 0003: expenses tracking (Batch 8, competitor-inspired).
-- Records landlord expenses for a real P&L: categories, one-time vs recurring,
-- tenant-payable flag, paid/unpaid, receipt + remarks. Optionally linked to a
-- property and/or lease. SAFE / ADDITIVE and idempotent ("if not exists").
-- Run once in the Supabase SQL editor before deploying the expenses API.

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  landlord_id uuid not null references public.landlords(id) on delete cascade,
  property_id uuid references public.properties(id) on delete set null,
  lease_id uuid references public.leases(id) on delete set null,
  category text not null default 'other'
    check (category in (
      'mortgage','taxes','insurance','repairs','landscape',
      'pest_control','management_fee','appliance','utilities','other'
    )),
  title text,
  amount numeric(12,2) not null check (amount >= 0),
  spent_on date not null default (now() at time zone 'utc')::date,
  is_recurring boolean not null default false,
  recur_interval text
    check (recur_interval is null or recur_interval in ('monthly','quarterly','yearly')),
  tenant_payable boolean not null default false,
  paid boolean not null default true,
  receipt_url text,
  remarks text,
  created_at timestamptz not null default now()
);

create index if not exists expenses_landlord_idx on public.expenses(landlord_id);
create index if not exists expenses_property_idx on public.expenses(property_id);
create index if not exists expenses_lease_idx on public.expenses(lease_id);
create index if not exists expenses_spent_on_idx on public.expenses(spent_on);

-- Enable RLS as a safety net. The backend uses the service role key (which
-- bypasses RLS), so app-level landlord_id scoping remains the primary guard.
alter table public.expenses enable row level security;
