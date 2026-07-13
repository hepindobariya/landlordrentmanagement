import { Router } from "express"
import { z } from "zod"
import { supabase } from "../../lib/supabase"
import { getLandlordId } from "../../middleware/auth"
import { asyncHandler } from "../../utils/asyncHandler"
import { firstDayOfCurrentMonthISO, todayISODate } from "../../utils/dates"
import { ApiError } from "../../utils/errors"
import { assertOwned } from "../../utils/ownership"
import { sendOk } from "../../utils/response"
import {
  idParamSchema,
  isoDateSchema,
  moneySchema,
  paginationSchema,
  roundMoney,
  uuidSchema,
} from "../../utils/validation"

// --- Charge period helpers -------------------------------------------------
// Pure UTC date math so the covered period is stable regardless of server TZ.
function shiftCycle(iso: string, cycle: string, count: number): string {
  const [y, m, d] = iso.split("-").map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  switch (cycle) {
    case "weekly":
      dt.setUTCDate(dt.getUTCDate() + 7 * count)
      break
    case "quarterly":
      dt.setUTCMonth(dt.getUTCMonth() + 3 * count)
      break
    case "yearly":
      dt.setUTCFullYear(dt.getUTCFullYear() + count)
      break
    default:
      dt.setUTCMonth(dt.getUTCMonth() + count)
  }
  return dt.toISOString().slice(0, 10)
}

function shiftDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + days)
  return dt.toISOString().slice(0, 10)
}

// prepaid  -> a charge on the due date covers the upcoming cycle.
// postpaid -> a charge on the due date covers the cycle that just ended.
function computeChargePeriod(dueDate: string, cycle: string, mode: string) {
  if (mode === "postpaid") {
    return { start: shiftCycle(dueDate, cycle, -1), end: shiftDays(dueDate, -1) }
  }
  return {
    start: dueDate,
    end: shiftDays(shiftCycle(dueDate, cycle, 1), -1),
  }
}

const generateSchema = z.object({
  lease_id: uuidSchema,
  // Optional overrides; default amount = lease rent, default due date = 1st of month.
  amount: moneySchema.optional(),
  due_date: isoDateSchema.optional(),
})

const listQuerySchema = paginationSchema.extend({
  lease_id: uuidSchema,
  status: z.enum(["due", "paid", "partial"]).optional(),
})

// Calendar endpoint: all charges for a given month (default current month).
const calendarQuerySchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/, "month must be in YYYY-MM format")
    .optional(),
})

const paySchema = z.object({
  amount_paid: moneySchema.optional(),
  paid_date: isoDateSchema.optional(),
})

export const rentChargesRouter = Router()

// GENERATE a monthly rent charge for a lease
rentChargesRouter.post(
  "/generate",
  asyncHandler(async (req, res) => {
    const landlordId = getLandlordId(req)
    const body = generateSchema.parse(req.body)

    // Load lease (scoped) to read the default rent amount.
    const { data: lease, error: leaseError } = await supabase
      .from("leases")
      .select(
        "id, rent_amount, billing_cycle, billing_mode, increment_pct, increment_months, last_revised_date"
      )
      .eq("landlord_id", landlordId)
      .eq("id", body.lease_id)
      .maybeSingle()

    if (leaseError) throw new ApiError(500, leaseError.message)
    if (!lease) throw new ApiError(404, "Lease not found")

    const dueDate = body.due_date ?? firstDayOfCurrentMonthISO()

    // Auto rent increment: when the lease has an increment schedule and the due
    // date has reached the next revision, bump the base rent and persist it.
    let effectiveRent = roundMoney(Number(lease.rent_amount))
    let appliedRevision: string | null = null
    if (
      lease.increment_pct != null &&
      lease.increment_months != null &&
      lease.last_revised_date
    ) {
      const nextRevision = shiftCycle(
        String(lease.last_revised_date),
        "monthly",
        Number(lease.increment_months)
      )
      if (dueDate >= nextRevision) {
        effectiveRent = roundMoney(
          effectiveRent * (1 + Number(lease.increment_pct) / 100)
        )
        appliedRevision = dueDate
      }
    }

    // Fixed recurring utility lines are added on top of the rent.
    const { data: utils, error: utilErr } = await supabase
      .from("lease_utilities")
      .select("billing, rate")
      .eq("landlord_id", landlordId)
      .eq("lease_id", body.lease_id)
    if (utilErr) throw new ApiError(500, utilErr.message)
    const utilTotal = roundMoney(
      (utils ?? [])
        .filter((u) => u.billing === "fixed")
        .reduce((a, u) => a + Number(u.rate ?? 0), 0)
    )

    const usingOverride = body.amount != null
    const amount = usingOverride
      ? roundMoney(Number(body.amount))
      : roundMoney(effectiveRent + utilTotal)
    // The period this charge covers, from the lease billing cycle + mode.
    const period = computeChargePeriod(
      dueDate,
      String(lease.billing_cycle ?? "monthly"),
      String(lease.billing_mode ?? "prepaid")
    )

    // Prevent duplicate charge for the same lease + due date.
    const { data: existing, error: existingError } = await supabase
      .from("rent_charges")
      .select("id")
      .eq("landlord_id", landlordId)
      .eq("lease_id", body.lease_id)
      .eq("due_date", dueDate)
      .maybeSingle()

    if (existingError) throw new ApiError(500, existingError.message)
    if (existing) {
      throw new ApiError(
        409,
        `A rent charge already exists for this lease on ${dueDate}`
      )
    }

    const { data, error } = await supabase
      .from("rent_charges")
      .insert({
        landlord_id: landlordId,
        lease_id: body.lease_id,
        amount,
        due_date: dueDate,
        period_start: period.start,
        period_end: period.end,
        status: "due",
        amount_paid: 0,
      })
      .select("*")
      .single()

    if (error) throw new ApiError(500, error.message)

    // Persist the raised rent so subsequent charges use the new base.
    if (appliedRevision && !usingOverride) {
      await supabase
        .from("leases")
        .update({
          rent_amount: effectiveRent,
          last_revised_date: appliedRevision,
        })
        .eq("landlord_id", landlordId)
        .eq("id", body.lease_id)
    }

    return sendOk(res, data, 201)
  })
)

// CALENDAR: every charge due within a month, with the tenant name attached.
// Powers the Rent Collection Calendar (day-level Paid / Partial / Unpaid).
rentChargesRouter.get(
  "/calendar",
  asyncHandler(async (req, res) => {
    const landlordId = getLandlordId(req)
    const { month } = calendarQuerySchema.parse(req.query)

    const m = month ?? firstDayOfCurrentMonthISO().slice(0, 7)
    const [yStr, moStr] = m.split("-")
    const y = Number(yStr)
    const mo = Number(moStr)
    const start = `${m}-01`
    const nextY = mo === 12 ? y + 1 : y
    const nextMo = mo === 12 ? 1 : mo + 1
    const end = `${nextY}-${String(nextMo).padStart(2, "0")}-01`

    const { data: charges, error } = await supabase
      .from("rent_charges")
      .select("id, lease_id, amount, amount_paid, due_date, paid_date, status")
      .eq("landlord_id", landlordId)
      .gte("due_date", start)
      .lt("due_date", end)
      .order("due_date", { ascending: true })

    if (error) throw new ApiError(500, error.message)

    // Attach tenant names (charge -> lease -> tenant), all landlord-scoped.
    const rows = charges ?? []
    const leaseIds = [...new Set(rows.map((c) => c.lease_id))]
    const tenantByLease = new Map<string, string>()

    if (leaseIds.length > 0) {
      const { data: leases, error: leaseErr } = await supabase
        .from("leases")
        .select("id, tenant_id")
        .eq("landlord_id", landlordId)
        .in("id", leaseIds)
      if (leaseErr) throw new ApiError(500, leaseErr.message)

      const tenantIds = [...new Set((leases ?? []).map((l) => l.tenant_id))]
      const nameById = new Map<string, string>()
      if (tenantIds.length > 0) {
        const { data: tenants, error: tenantErr } = await supabase
          .from("tenants")
          .select("id, full_name")
          .eq("landlord_id", landlordId)
          .in("id", tenantIds)
        if (tenantErr) throw new ApiError(500, tenantErr.message)
        for (const t of tenants ?? []) nameById.set(t.id, t.full_name)
      }
      for (const l of leases ?? []) {
        tenantByLease.set(l.id, nameById.get(l.tenant_id) ?? "Tenant")
      }
    }

    const items = rows.map((c) => ({
      ...c,
      tenant_name: tenantByLease.get(c.lease_id) ?? "Tenant",
    }))

    return sendOk(res, { month: m, start, end, charges: items })
  })
)

// LIST charges by lease (?lease_id= required, optional &status=, pagination)
rentChargesRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const landlordId = getLandlordId(req)
    const q = listQuerySchema.parse(req.query)

    await assertOwned("leases", q.lease_id, landlordId, "Lease")

    let query = supabase
      .from("rent_charges")
      .select("*")
      .eq("landlord_id", landlordId)
      .eq("lease_id", q.lease_id)

    if (q.status) query = query.eq("status", q.status)

    query = query.order("due_date", { ascending: false })

    if (q.limit != null) {
      const from = q.offset ?? 0
      query = query.range(from, from + q.limit - 1)
    }

    const { data, error } = await query
    if (error) throw new ApiError(500, error.message)
    return sendOk(res, data)
  })
)

// MARK AS PAID (full or partial) — legacy quick-pay. For itemized payments
// with a channel + receipt, use POST /api/v1/payments instead.
rentChargesRouter.post(
  "/:id/pay",
  asyncHandler(async (req, res) => {
    const landlordId = getLandlordId(req)
    const { id } = idParamSchema.parse(req.params)
    const body = paySchema.parse(req.body ?? {})

    // Load the charge (scoped) to know its total amount.
    const { data: charge, error: chargeError } = await supabase
      .from("rent_charges")
      .select("id, amount")
      .eq("landlord_id", landlordId)
      .eq("id", id)
      .maybeSingle()

    if (chargeError) throw new ApiError(500, chargeError.message)
    if (!charge) throw new ApiError(404, "Rent charge not found")

    // Round both sides so the paid/partial decision is exact at paise level.
    const total = roundMoney(Number(charge.amount))
    const amountPaid = roundMoney(body.amount_paid ?? total)
    const status = amountPaid >= total ? "paid" : "partial"

    const { data, error } = await supabase
      .from("rent_charges")
      .update({
        amount_paid: amountPaid,
        status,
        paid_date: body.paid_date ?? todayISODate(),
      })
      .eq("landlord_id", landlordId)
      .eq("id", id)
      .select("*")
      .maybeSingle()

    if (error) throw new ApiError(500, error.message)
    if (!data) throw new ApiError(404, "Rent charge not found")
    return sendOk(res, data)
  })
)
