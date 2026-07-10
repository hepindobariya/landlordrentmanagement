-- 0002_property_metadata_and_billing_mode.sql
-- Batch 1 schema additions (RentGet-inspired).
-- SAFE / ADDITIVE: every column is nullable or has a default and uses
-- "add column if not exists", so this can be run once on the existing
-- database without touching current rows or breaking existing API calls.
-- Run in the Supabase SQL editor (or via the migration runner) BEFORE
-- deploying the Batch 1 backend.

-- ---------------------------------------------------------------------------
-- Property metadata
-- ---------------------------------------------------------------------------
alter table properties add column if not exists property_type text
  check (property_type is null or property_type in ('residential', 'commercial'));
alter table properties add column if not exists furnishing text
  check (furnishing is null or furnishing in ('unfurnished', 'semi_furnished', 'furnished'));
alter table properties add column if not exists maps_link text;
alter table properties add column if not exists floors integer
  check (floors is null or floors >= 0);
alter table properties add column if not exists area_sqft numeric(12, 2)
  check (area_sqft is null or area_sqft >= 0);
alter table properties add column if not exists amenities text;
alter table properties add column if not exists owner_name text;
alter table properties add column if not exists owner_phone text;
alter table properties add column if not exists owner_email text;
alter table properties add column if not exists owner_pan text;

-- ---------------------------------------------------------------------------
-- Lease billing mode (pre-paid vs post-paid)
--   prepaid  = rent collected in advance for the current / coming period
--   postpaid = rent collected in arrears for the previous period
-- Defaults to 'prepaid' so existing leases keep their current behaviour.
-- ---------------------------------------------------------------------------
alter table leases add column if not exists billing_mode text
  not null default 'prepaid'
  check (billing_mode in ('prepaid', 'postpaid'));
