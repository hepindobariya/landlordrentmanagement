import { Router } from "express"
import { z } from "zod"
import { supabase } from "../../lib/supabase"
import { getLandlordId } from "../../middleware/auth"
import { asyncHandler } from "../../utils/asyncHandler"
import { todayISODate } from "../../utils/dates"
import { ApiError } from "../../utils/errors"
import { assertOwned } from "../../utils/ownership"
import { sendOk } from "../../utils/response"
import { idParamSchema, isoDateSchema, uuidSchema } from "../../utils/validation"

// Cash is first-class: the ledger records what actually happened, by channel.
const methodEnum = z.enum(["cash", "upi", "bank_transfer", "card", "other"])

const createSchema = z.object({
  rent_charge_id: uuidSchema,
  // Optional; defaults to the charge's remaining balance.
  amount: z.number().positive().optional(),
  method: methodEnum.default("cash"),
  paid_date: isoDateSchema.optional(),
  reference: z.string().max(200).optional(),
  note: z.string().max(500).optional(),
})

const listQuerySchema = z
  .object({
    rent_charge_id: uuidSchema.optional(),
    lease_id: uuidSchema.optional(),
  })
  .refine((d) => Boolean(d.rent_charge_id || d.lease_id), {
    message: "rent_charge_id or lease_id query param is required",
  })

// Round to 2 dp to match numeric(12,2) and avoid float drift.
function round2(n: number): number {
  return Math.round((Number.isFinite(n) ? n : 0) * 100) / 100
}

// SINGLE SOURCE OF TRUTH: recompute a charge's amount_paid + status purely from
// the payments ledger. Called after every insert AND delete so edits never drift.
//   amount_paid = 0            -> "due"
//   0 < amount_paid < amount   -> "partial"
//   amount_paid >= amount      -> "paid"
// Returns the updated charge plus its (unstored) remaining balance.
async function recomputeCharge(
  landlordId: string,
  rentChargeId: string
): Promise<{ charge: Record<string, unknown> | null; remaining_balance: number }> {
  const { data: charge, error: chargeErr } = await supabase
    .from("rent_charges")
    .select("id, amount")
    .eq("landlord_id", landlordId)
    .eq("id", rentChargeId)
    .maybeSingle()
  if (chargeErr) throw new ApiError(500, chargeErr.message)
  if (!charge) throw new ApiError(404, "Rent charge not found")

  const { data: pays, error: paysErr } = await supabase
    .from("payments")
    .select("amount, paid_date")
    .eq("landlord_id", landlordId)
    .eq("rent_charge_id", rentChargeId)
  if (paysErr) throw new ApiError(500, paysErr.message)

  const total = round2(Number(charge.amount))
  const amountPaid = round2(
    (pays ?? []).reduce((sum, p) => sum + Number(p.amount ?? 0), 0)
  )
  const status =
    amountPaid <= 0 ? "due" : amountPaid >= total ? "paid" : "partial"

  // When fully paid, stamp the latest payment date; otherwise clear it.
  const latestPaidDate =
    status === "paid" && pays && pays.length
      ? (pays
          .map((p) => p.paid_date as string | null)
          .filter((d): d is string => Boolean(d))
          .sort()
          .slice(-1)[0] ?? null)
      : null

  const { data: updated, error: updErr } = await supabase
    .from("rent_charges")
    .update({ amount_paid: amountPaid, status, paid_date: latestPaidDate })
    .eq("landlord_id", landlordId)
    .eq("id", rentChargeId)
    .select("*")
    .maybeSingle()
  if (updErr) throw new ApiError(500, updErr.message)

  return { charge: updated, remaining_balance: round2(Math.max(total - amountPaid, 0)) }
}

export const paymentsRouter = Router()

// RECORD a payment against a rent charge (supports partial + cash).
// Inserts the ledger entry, then recomputes the charge from the ledger.
paymentsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const landlordId = getLandlordId(req)
    const body = createSchema.parse(req.body)

    // Load the charge (scoped) to compute the default amount = remaining balance.
    const { data: charge, error: chargeErr } = await supabase
      .from("rent_charges")
      .select("id, lease_id, amount, amount_paid")
      .eq("landlord_id", landlordId)
      .eq("id", body.rent_charge_id)
      .maybeSingle()

    if (chargeErr) throw new ApiError(500, chargeErr.message)
    if (!charge) throw new ApiError(404, "Rent charge not found")

    const total = round2(Number(charge.amount))
    const alreadyPaid = round2(Number(charge.amount_paid ?? 0))
    const remainingBefore = Math.max(round2(total - alreadyPaid), 0)
    const amount = round2(body.amount ?? remainingBefore)

    if (amount <= 0) {
      throw new ApiError(400, "Nothing left to pay on this charge")
    }

    const paidDate = body.paid_date ?? todayISODate()
    const receiptNo = `RCPT-${Date.now()}`

    // Insert the payment (ledger entry + receipt).
    const { data: payment, error: payErr } = await supabase
      .from("payments")
      .insert({
        landlord_id: landlordId,
        rent_charge_id: charge.id,
        lease_id: charge.lease_id,
        amount,
        method: body.method,
        paid_date: paidDate,
        reference: body.reference ?? null,
        note: body.note ?? null,
        receipt_no: receiptNo,
      })
      .select("*")
      .single()

    if (payErr) throw new ApiError(500, payErr.message)

    // Recompute the charge from the full ledger (never increment).
    const rollup = await recomputeCharge(landlordId, charge.id)

    return sendOk(
      res,
      {
        payment,
        charge: rollup.charge,
        remaining_balance: rollup.remaining_balance,
      },
      201
    )
  })
)

// LIST payments for a charge or a lease.
paymentsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const landlordId = getLandlordId(req)
    const q = listQuerySchema.parse(req.query)

    if (q.lease_id) {
      await assertOwned("leases", q.lease_id, landlordId, "Lease")
    }

    let query = supabase
      .from("payments")
      .select("*")
      .eq("landlord_id", landlordId)

    if (q.rent_charge_id) query = query.eq("rent_charge_id", q.rent_charge_id)
    if (q.lease_id) query = query.eq("lease_id", q.lease_id)

    const { data, error } = await query.order("paid_date", { ascending: false })

    if (error) throw new ApiError(500, error.message)
    return sendOk(res, data)
  })
)

// DELETE a payment, then recompute the linked charge from the remaining ledger.
paymentsRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const landlordId = getLandlordId(req)
    const { id } = idParamSchema.parse(req.params)

    const { data: existing, error: findErr } = await supabase
      .from("payments")
      .select("id, rent_charge_id")
      .eq("landlord_id", landlordId)
      .eq("id", id)
      .maybeSingle()

    if (findErr) throw new ApiError(500, findErr.message)
    if (!existing) throw new ApiError(404, "Payment not found")

    const { error: delErr } = await supabase
      .from("payments")
      .delete()
      .eq("landlord_id", landlordId)
      .eq("id", id)

    if (delErr) throw new ApiError(500, delErr.message)

    let rollup: { charge: Record<string, unknown> | null; remaining_balance: number } | null =
      null
    if (existing.rent_charge_id) {
      rollup = await recomputeCharge(landlordId, String(existing.rent_charge_id))
    }

    return sendOk(res, {
      deleted: true,
      id,
      charge: rollup?.charge ?? null,
      remaining_balance: rollup?.remaining_balance ?? null,
    })
  })
)