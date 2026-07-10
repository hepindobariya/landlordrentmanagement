import { Router } from "express"
import { supabase } from "../../lib/supabase"
import { getLandlordId } from "../../middleware/auth"
import { asyncHandler } from "../../utils/asyncHandler"
import { ApiError } from "../../utils/errors"
import { sendOk } from "../../utils/response"

export const reportsRouter = Router()

function round2(n: number): number {
  return Math.round((Number.isFinite(n) ? n : 0) * 100) / 100
}

// Returns the [start, end) YYYY-MM-DD bounds of the current UTC month.
function currentMonthBounds(now = new Date()): { start: string; end: string } {
  const y = now.getUTCFullYear()
  const m = now.getUTCMonth()
  const start = `${y}-${String(m + 1).padStart(2, "0")}-01`
  const end = new Date(Date.UTC(y, m + 1, 1)).toISOString().slice(0, 10)
  return { start, end }
}

// GET /api/v1/reports/summary
// Landlord dashboard:
//   Occupancy  = distinct units with an active lease / total units
//   Collected  = sum of PAYMENTS whose paid_date falls in this month (true ledger)
//   Expected   = sum of rent charges whose due_date falls in this month
// Plus outstanding totals (overall + per property) and open maintenance tickets.
reportsRouter.get(
  "/summary",
  asyncHandler(async (req, res) => {
    const landlordId = getLandlordId(req)
    const { start, end } = currentMonthBounds()

    const [propsRes, unitsRes, leasesRes, chargesRes, paymentsRes, ticketsRes] =
      await Promise.all([
        supabase
          .from("properties")
          .select("id, name")
          .eq("landlord_id", landlordId),
        supabase
          .from("units")
          .select("id, property_id")
          .eq("landlord_id", landlordId),
        supabase
          .from("leases")
          .select("id, unit_id, status")
          .eq("landlord_id", landlordId),
        supabase
          .from("rent_charges")
          .select("lease_id, amount, amount_paid, status, due_date")
          .eq("landlord_id", landlordId),
        supabase
          .from("payments")
          .select("amount, paid_date")
          .eq("landlord_id", landlordId),
        supabase
          .from("maintenance_tickets")
          .select("id, status")
          .eq("landlord_id", landlordId),
      ])

    for (const r of [
      propsRes,
      unitsRes,
      leasesRes,
      chargesRes,
      paymentsRes,
      ticketsRes,
    ]) {
      if (r.error) throw new ApiError(500, r.error.message)
    }

    const properties = propsRes.data ?? []
    const units = unitsRes.data ?? []
    const leases = leasesRes.data ?? []
    const charges = chargesRes.data ?? []
    const payments = paymentsRes.data ?? []
    const tickets = ticketsRes.data ?? []

    // Occupancy = distinct units that currently have an active lease.
    const activeUnitIds = new Set(
      leases.filter((l) => l.status === "active").map((l) => l.unit_id)
    )
    const occupied = [...activeUnitIds].filter((id) => id != null).length
    const totalUnits = units.length

    // lease -> property lookup (lease -> unit -> property).
    const unitToProperty = new Map(units.map((u) => [u.id, u.property_id]))
    const leaseToProperty = new Map(
      leases.map((l) => [l.id, unitToProperty.get(l.unit_id) ?? null])
    )
    const propertyName = new Map(properties.map((p) => [p.id, p.name]))

    // Expected this month = charges due this month.
    const expectedThisMonth = round2(
      charges
        .filter((c) => c.due_date >= start && c.due_date < end)
        .reduce((a, c) => a + Number(c.amount ?? 0), 0)
    )

    // Collected this month = payments actually recorded this month (by paid_date).
    const collectedThisMonth = round2(
      payments
        .filter((p) => p.paid_date >= start && p.paid_date < end)
        .reduce((a, p) => a + Number(p.amount ?? 0), 0)
    )

    // Outstanding across all charges (positive remaining balances).
    const outstandingByProperty = new Map<string, number>()
    let outstandingTotal = 0
    let outstandingCount = 0
    for (const c of charges) {
      const balance = Number(c.amount ?? 0) - Number(c.amount_paid ?? 0)
      if (balance > 0) {
        outstandingTotal += balance
        outstandingCount += 1
        const pid = leaseToProperty.get(c.lease_id) ?? "unassigned"
        outstandingByProperty.set(
          pid,
          (outstandingByProperty.get(pid) ?? 0) + balance
        )
      }
    }

    const outstanding_by_property = [...outstandingByProperty.entries()]
      .map(([pid, amount]) => ({
        property_id: pid === "unassigned" ? null : pid,
        property_name:
          pid === "unassigned"
            ? "Unassigned"
            : propertyName.get(pid) ?? "Unknown",
        outstanding: round2(amount),
      }))
      .sort((a, b) => b.outstanding - a.outstanding)

    const ticketsOpen = tickets.filter((t) => t.status !== "closed").length

    return sendOk(res, {
      month: start,
      collected_this_month: collectedThisMonth,
      expected_this_month: expectedThisMonth,
      outstanding_total: round2(outstandingTotal),
      outstanding_charges: outstandingCount,
      outstanding_by_property,
      properties: properties.length,
      units: totalUnits,
      occupied,
      occupancy_pct: totalUnits ? Math.round((occupied / totalUnits) * 100) : 0,
      tickets_open: ticketsOpen,
    })
  })
)