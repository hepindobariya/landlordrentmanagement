# Landlord Rent Management — Update Pack

These are the files changed **since the v6 build**. Drop them into your repo at the
same paths (they preserve the `backend/` and `mobile/` folder structure), commit,
and deploy. Nothing else in the app needs to change.

## ⚠️ Run these DB migrations first (Supabase, in order)
Run in Supabase SQL editor before deploying the backend:

1. `backend/migrations/0003_expenses.sql`  — creates the `expenses` table (Batch 8).
2. `backend/migrations/0004_lease_settlement.sql`  — adds settlement columns to `leases` (Batch 10).

> Still pending from earlier (unchanged): `0001_payments.sql` and
> `0002_property_metadata_and_billing_mode.sql` must also be run if you haven't
> already — payments + Batch 1 depend on them.

## New files (add)
- `backend/migrations/0003_expenses.sql`
- `backend/migrations/0004_lease_settlement.sql`
- `backend/src/modules/expenses/expenses.routes.ts`
- `mobile/src/screens/ExpensesScreen.tsx`
- `mobile/src/screens/ExpenseFormScreen.tsx`

## Modified files (overwrite)
- `backend/src/routes/index.ts`  — mounts `/api/v1/expenses`.
- `backend/src/modules/leases/leases.routes.ts`  — `/:id/end` + `PATCH` now accept settlement fields.
- `mobile/src/types.ts`  — adds Expense types + `deposit_returned` / `final_settlement_date` / `settlement_notes` on `Lease`.
- `mobile/src/navigation/AppNavigator.tsx`  — registers Expenses + ExpenseForm screens and the quick-add "New expense" entry.
- `mobile/src/screens/HomeScreen.tsx`  — adds Expenses to the tools grid.
- `mobile/src/lib/api.ts`  — global 401 handler (expired session -> sign out -> Login).
- `mobile/src/screens/LeaseDetailScreen.tsx`  — "End lease & settle" flow + settlement summary.
- `mobile/src/screens/LeasesScreen.tsx`  — Active / Archived filter tabs.

## What's in this pack (features)
1. **Batch 8 — Expense tracking** (biggest competitor gap): expenses table + full REST API
   (`/api/v1/expenses`, list/filter/summary/CRUD) + Expenses screen (summary hero, category
   filter chips) + Expense form (categories, recurring, tenant-payable, paid toggles).
2. **Batch 10 — Lease archive + final settlement**: end-lease flow capturing deposit
   returned / settlement date / notes; Active vs Archived leases toggle.
3. **Auth 401 auto-signout**: expired token returns the user to Login instead of a generic error.

## No new native modules
All changes are pure JS/TS + SQL — **no new native dependencies**, so this is OTA/JS-bundle
safe. No `expo install` or fresh native EAS build is required for these changes
(you still need a native build only if a *separate* change added a native module).
