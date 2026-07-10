import { Router } from "express"
import { supabase } from "../../lib/supabase"
import { getLandlordId } from "../../middleware/auth"
import { asyncHandler } from "../../utils/asyncHandler"
import { currentMonthBoundsISO } from "../../utils/dates"
import { ApiError } from "../../utils/errors"
import { sendOk } from "../../utils/response"
import { roundMoney } from "../../utils/validation"

export const reportsRouter = Router()

// GET /api/v1/reports/summary
// Landlord dashboard: collections vs expected this month, outstanding totals
// (overall + per property), occupancy, and open maintenance tickets.
reportsRouter.get(
  "/summary",
  asyncHandler(async (req, res) => {
    const landlordId = getLandlordId(req)
    // Month bounds are computed in the business timezone (default IST) so the
    // "this month" window matches what the landlord actually sees locally.
    const { start, end } = currentMonthBoundsISO()

    const [propsRes, unitsRes, leasesRes, chargesRes, ticketsRes] =
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
          .from("maintenance_tickets")
          .select("id, status")
          .eq("landlord_id", landlordId),
      ])

    for (const r of [propsRes, unitsRes, leasesRes, chargesRes, ticketsRes]) {
      if (r.error) throw new ApiError(500, r.error.message)
    }

    const properties = propsRes.data ?? []
    const units = unitsRes.data ?? []
    const leases = leasesRes.data ?? []
    const charges = chargesRes.data ?? []
    const tickets = ticketsRes.data ?? []

    // Occupancy = distinct units that currently have an active lease.
    const activeUnitIds = new Set(
      leases.filter((l) => l.status === "active").map((l) => l.unit_id)
    )
    const occupied = [...activeUnitIds].filter((id) => id != null).length
    const totalUnits = units.length

    // Build lease -> property lookup (lease -> unit -> property).
    const unitToProperty = new Map(units.map((u) => [u.id, u.property_id]))
    const leaseToProperty = new Map(
      leases.map((l) => [l.id, unitToProperty.get(l.unit_id) ?? null])
    )
    const propertyName = new Map(properties.map((p) => [p.id, p.name]))

    // This month's collections vs expected (rounded to avoid float drift).
    const thisMonth = charges.filter(
      (c) => c.due_date >= start && c.due_date < end
    )
    const collectedThisMonth = roundMoney(
      thisMonth.reduce((a, c) => a + Number(c.amount_paid ?? 0), 0)
    )
    const expectedThisMonth = roundMoney(
      thisMonth.reduce((a, c) => a + Number(c.amount ?? 0), 0)
    )

    // Outstanding across all charges (positive remaining balances).
    const outstandingByProperty = new Map<string, number>()
    let outstandingTotal = 0
    let outstandingCount = 0
    for (const c of charges) {
      const balance = roundMoney(
        Number(c.amount ?? 0) - Number(c.amount_paid ?? 0)
      )
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
        outstanding: roundMoney(amount),
      }))
      .sort((a, b) => b.outstanding - a.outstanding)

    const ticketsOpen = tickets.filter((t) => t.status !== "closed").length

    return sendOk(res, {
      month: start,
      collected_this_month: collectedThisMonth,
      expected_this_month: expectedThisMonth,
      outstanding_total: roundMoney(outstandingTotal),
      outstanding_charges: outstandingCount,
      outstanding_by_property,
      properties: properties.length,
      units: totalUnits,
      occupied,
      occupancy_pct: totalUnits
        ? Math.round((occupied / totalUnits) * 100)
        : 0,
      tickets_open: ticketsOpen,
    })
  })
)
