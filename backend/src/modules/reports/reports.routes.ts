import { Router } from "express"
import { supabase } from "../../lib/supabase"
import { getLandlordId } from "../../middleware/auth"
import { asyncHandler } from "../../utils/asyncHandler"
import { currentMonthBoundsISO } from "../../utils/dates"
import { ApiError } from "../../utils/errors"
import { sendOk } from "../../utils/response"
import { z } from "zod"
import { roundMoney } from "../../utils/validation"

const exportQuerySchema = z.object({
  type: z.enum(["rent", "tenants", "expenses", "units"]).default("rent"),
})

function csvEscape(v: unknown): string {
  const s = v == null ? "" : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function toCsv(
  headers: string[],
  rows: Array<Array<string | number | null | undefined>>
): string {
  const lines = [headers.map(csvEscape).join(",")]
  for (const r of rows) lines.push(r.map(csvEscape).join(","))
  return lines.join("\n")
}

export const reportsRouter = Router()

// GET /api/v1/reports/export?type=rent|tenants|expenses|units
// Returns a CSV download (text/csv) for the requested dataset, landlord-scoped.
reportsRouter.get(
  "/export",
  asyncHandler(async (req, res) => {
    const landlordId = getLandlordId(req)
    const { type } = exportQuerySchema.parse(req.query)

    let headers: string[] = []
    let rows: Array<Array<string | number | null | undefined>> = []

    if (type === "tenants") {
      const { data, error } = await supabase
        .from("tenants")
        .select("full_name, email, phone, created_at")
        .eq("landlord_id", landlordId)
        .order("created_at", { ascending: false })
      if (error) throw new ApiError(500, error.message)
      headers = ["Name", "Email", "Phone", "Added"]
      rows = (data ?? []).map((t) => [
        t.full_name,
        t.email,
        t.phone,
        String(t.created_at).slice(0, 10),
      ])
    } else if (type === "expenses") {
      const { data, error } = await supabase
        .from("expenses")
        .select(
          "spent_on, category, title, amount, paid, tenant_payable, remarks"
        )
        .eq("landlord_id", landlordId)
        .order("spent_on", { ascending: false })
      if (error) throw new ApiError(500, error.message)
      headers = [
        "Date",
        "Category",
        "Title",
        "Amount",
        "Paid",
        "Tenant payable",
        "Remarks",
      ]
      rows = (data ?? []).map((e) => [
        e.spent_on,
        e.category,
        e.title,
        e.amount,
        e.paid ? "Yes" : "No",
        e.tenant_payable ? "Yes" : "No",
        e.remarks,
      ])
    } else if (type === "units") {
      const { data, error } = await supabase
        .from("units")
        .select("unit_number, description, bedrooms, bathrooms")
        .eq("landlord_id", landlordId)
        .order("created_at", { ascending: false })
      if (error) throw new ApiError(500, error.message)
      headers = ["Unit", "Description", "Bedrooms", "Bathrooms"]
      rows = (data ?? []).map((u) => [
        u.unit_number,
        u.description,
        u.bedrooms,
        u.bathrooms,
      ])
    } else {
      const { data, error } = await supabase
        .from("rent_charges")
        .select(
          "due_date, amount, amount_paid, status, paid_date, period_start, period_end"
        )
        .eq("landlord_id", landlordId)
        .order("due_date", { ascending: false })
      if (error) throw new ApiError(500, error.message)
      headers = [
        "Due date",
        "Amount",
        "Amount paid",
        "Status",
        "Paid on",
        "Period start",
        "Period end",
      ]
      rows = (data ?? []).map((c) => [
        c.due_date,
        c.amount,
        c.amount_paid,
        c.status,
        c.paid_date,
        c.period_start,
        c.period_end,
      ])
    }

    const csv = toCsv(headers, rows)
    res.setHeader("Content-Type", "text/csv; charset=utf-8")
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${type}-export.csv"`
    )
    return res.status(200).send(csv)
  })
)

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

// GET /api/v1/reports/trends
// Collections vs expected (and outstanding) for the last 5 calendar months,
// oldest first. Powers the dashboard trend chart.
reportsRouter.get(
  "/trends",
  asyncHandler(async (req, res) => {
    const landlordId = getLandlordId(req)

    const { data: charges, error } = await supabase
      .from("rent_charges")
      .select("amount, amount_paid, due_date")
      .eq("landlord_id", landlordId)

    if (error) throw new ApiError(500, error.message)

    const now = new Date()
    const months: string[] = []
    for (let i = 4; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      months.push(
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
      )
    }

    const acc = new Map<string, { collected: number; expected: number }>()
    for (const key of months) acc.set(key, { collected: 0, expected: 0 })

    for (const c of charges ?? []) {
      const key = String(c.due_date).slice(0, 7)
      const entry = acc.get(key)
      if (entry) {
        entry.expected += Number(c.amount ?? 0)
        entry.collected += Number(c.amount_paid ?? 0)
      }
    }

    const trend = months.map((key) => {
      const entry = acc.get(key) ?? { collected: 0, expected: 0 }
      const collected = roundMoney(entry.collected)
      const expected = roundMoney(entry.expected)
      return {
        month: key,
        collected,
        expected,
        outstanding: roundMoney(Math.max(0, expected - collected)),
      }
    })

    return sendOk(res, { trend })
  })
)
