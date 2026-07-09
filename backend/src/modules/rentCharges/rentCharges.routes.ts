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
  paginationSchema,
  uuidSchema,
} from "../../utils/validation"

const generateSchema = z.object({
  lease_id: uuidSchema,
  // Optional overrides; default amount = lease rent, default due date = 1st of month.
  amount: z.number().nonnegative().optional(),
  due_date: isoDateSchema.optional(),
})

const listQuerySchema = paginationSchema.extend({
  lease_id: uuidSchema,
  status: z.enum(["due", "paid", "partial"]).optional(),
})

const paySchema = z.object({
  amount_paid: z.number().nonnegative().optional(),
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
      .select("id, rent_amount")
      .eq("landlord_id", landlordId)
      .eq("id", body.lease_id)
      .maybeSingle()

    if (leaseError) throw new ApiError(500, leaseError.message)
    if (!lease) throw new ApiError(404, "Lease not found")

    const amount = body.amount ?? Number(lease.rent_amount)
    const dueDate = body.due_date ?? firstDayOfCurrentMonthISO()

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
        status: "due",
        amount_paid: 0,
      })
      .select("*")
      .single()

    if (error) throw new ApiError(500, error.message)
    return sendOk(res, data, 201)
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

    const total = Number(charge.amount)
    const amountPaid = body.amount_paid ?? total
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
