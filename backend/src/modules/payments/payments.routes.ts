import { Router } from "express"
import { z } from "zod"
import { supabase } from "../../lib/supabase"
import { getLandlordId } from "../../middleware/auth"
import { asyncHandler } from "../../utils/asyncHandler"
import { todayISODate } from "../../utils/dates"
import { ApiError } from "../../utils/errors"
import { assertOwned } from "../../utils/ownership"
import { sendOk } from "../../utils/response"
import {
  isoDateSchema,
  positiveMoneySchema,
  roundMoney,
  uuidSchema,
} from "../../utils/validation"

// Cash is first-class: the ledger records what actually happened, by channel.
const methodEnum = z.enum(["cash", "upi", "bank_transfer", "card", "other"])

const createSchema = z.object({
  rent_charge_id: uuidSchema,
  // Optional; defaults to the charge's remaining balance. Accepts comma/₹
  // strings and is rounded to paise.
  amount: positiveMoneySchema.optional(),
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

export const paymentsRouter = Router()

// RECORD a payment against a rent charge (supports partial + cash).
// Also updates the charge's amount_paid + status and issues a receipt number.
paymentsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const landlordId = getLandlordId(req)
    const body = createSchema.parse(req.body)

    // Load the charge (scoped) to compute the remaining balance.
    const { data: charge, error: chargeErr } = await supabase
      .from("rent_charges")
      .select("id, lease_id, amount, amount_paid")
      .eq("landlord_id", landlordId)
      .eq("id", body.rent_charge_id)
      .maybeSingle()

    if (chargeErr) throw new ApiError(500, chargeErr.message)
    if (!charge) throw new ApiError(404, "Rent charge not found")

    // Round every money value so balances and status are exact at paise level.
    const total = roundMoney(Number(charge.amount))
    const alreadyPaid = roundMoney(Number(charge.amount_paid ?? 0))
    const remaining = roundMoney(Math.max(total - alreadyPaid, 0))
    const amount = roundMoney(body.amount ?? remaining)

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

    // Roll the charge's paid total + status forward.
    const newPaid = roundMoney(alreadyPaid + amount)
    const status = newPaid >= total ? "paid" : "partial"
    const { data: updatedCharge, error: updErr } = await supabase
      .from("rent_charges")
      .update({
        amount_paid: newPaid,
        status,
        paid_date: status === "paid" ? paidDate : null,
      })
      .eq("landlord_id", landlordId)
      .eq("id", charge.id)
      .select("*")
      .maybeSingle()

    if (updErr) throw new ApiError(500, updErr.message)

    return sendOk(res, { payment, charge: updatedCharge }, 201)
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

    const { data, error } = await query.order("paid_date", {
      ascending: false,
    })

    if (error) throw new ApiError(500, error.message)
    return sendOk(res, data)
  })
)
