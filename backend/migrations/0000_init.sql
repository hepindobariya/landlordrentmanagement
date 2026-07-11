-- Migration 0000: Initial schema (Core tables)
-- Run this first on a completely fresh Supabase project.

create table if not exists public.landlords (
  id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.properties (
  id uuid primary key default gen_random_uuid(),
  landlord_id uuid not null references public.landlords(id) on delete cascade,
  name text not null,
  address text,
  created_at timestamptz not null default now()
);

create table if not exists public.units (
  id uuid primary key default gen_random_uuid(),
  landlord_id uuid not null references public.landlords(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  unit_number text not null,
  description text,
  bedrooms integer,
  bathrooms integer,
  created_at timestamptz not null default now()
);

create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  landlord_id uuid not null references public.landlords(id) on delete cascade,
  full_name text not null,
  email text,
  phone text,
  created_at timestamptz not null default now()
);

create table if not exists public.leases (
  id uuid primary key default gen_random_uuid(),
  landlord_id uuid not null references public.landlords(id) on delete cascade,
  unit_id uuid not null references public.units(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  rent_amount numeric(12,2) not null check (rent_amount >= 0),
  deposit numeric(12,2) not null default 0 check (deposit >= 0),
  start_date date not null,
  end_date date,
  billing_cycle text not null default 'monthly' check (billing_cycle in ('weekly', 'monthly', 'quarterly', 'yearly')),
  status text not null default 'active' check (status in ('active', 'ended')),
  created_at timestamptz not null default now()
);

create table if not exists public.rent_charges (
  id uuid primary key default gen_random_uuid(),
  landlord_id uuid not null references public.landlords(id) on delete cascade,
  lease_id uuid not null references public.leases(id) on delete cascade,
  amount numeric(12,2) not null check (amount >= 0),
  amount_paid numeric(12,2) not null default 0 check (amount_paid >= 0),
  due_date date not null,
  paid_date date,
  status text not null default 'due' check (status in ('due', 'partial', 'paid')),
  created_at timestamptz not null default now()
);

create table if not exists public.maintenance_tickets (
  id uuid primary key default gen_random_uuid(),
  landlord_id uuid not null references public.landlords(id) on delete cascade,
  unit_id uuid not null references public.units(id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'open' check (status in ('open', 'in_progress', 'closed')),
  created_at timestamptz not null default now()
);

create table if not exists public.app_releases (
  id uuid primary key default gen_random_uuid(),
  platform text not null,
  build_id text,
  apk_url text not null,
  created_at timestamptz not null default now()
);

-- Indexes for performance
create index if not exists properties_landlord_idx on public.properties(landlord_id);
create index if not exists units_property_idx on public.units(property_id);
create index if not exists leases_unit_idx on public.leases(unit_id);
create index if not exists rent_charges_lease_idx on public.rent_charges(lease_id);
create index if not exists maintenance_unit_idx on public.maintenance_tickets(unit_id);

-- Enable RLS
alter table public.landlords enable row level security;
alter table public.properties enable row level security;
alter table public.units enable row level security;
alter table public.tenants enable row level security;
alter table public.leases enable row level security;
alter table public.rent_charges enable row level security;
alter table public.maintenance_tickets enable row level security;
alter table public.app_releases enable row level security;
