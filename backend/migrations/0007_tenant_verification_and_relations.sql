-- Migration 0007: tenant verification fields + co-tenants & references.
-- Run once in Supabase. Additive and idempotent.

-- Verification fields on the tenant (KYC provider wired later behind a flag).
alter table public.tenants add column if not exists pan text;
alter table public.tenants add column if not exists aadhaar_last4 text;
alter table public.tenants add column if not exists verification_status text
  default 'unverified'
  check (verification_status in ('unverified','pending','verified','failed'));
alter table public.tenants add column if not exists verified_at timestamptz;

create table if not exists public.co_tenants (
  id uuid primary key default gen_random_uuid(),
  landlord_id uuid not null references public.landlords(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  full_name text not null,
  relation text,
  phone text,
  email text,
  same_address boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.tenant_references (
  id uuid primary key default gen_random_uuid(),
  landlord_id uuid not null references public.landlords(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  full_name text not null,
  relation text,
  phone text,
  email text,
  created_at timestamptz not null default now()
);

create index if not exists co_tenants_tenant_idx on public.co_tenants(tenant_id);
create index if not exists co_tenants_landlord_idx on public.co_tenants(landlord_id);
create index if not exists tenant_references_tenant_idx on public.tenant_references(tenant_id);
create index if not exists tenant_references_landlord_idx on public.tenant_references(landlord_id);

alter table public.co_tenants enable row level security;
alter table public.tenant_references enable row level security;
