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
  idParamSchema,
  isoDateSchema,
  moneySchema,
  paginationSchema,
  uuidSchema,
} from "../../utils/validation"

const billingCycleEnum = z.enum(["weekly", "monthly", "quarterly", "yearly"])
// prepaid  = rent collected in advance for the current / coming period
// postpaid = rent collected in arrears for the previous period
const billingModeEnum = z.enum(["prepaid", "postpaid"])

const createSchema = z
  .object({
    unit_id: uuidSchema,
    tenant_id: uuidSchema,
    // moneySchema accepts numbers or comma/₹ strings and rounds to paise.
    rent_amount: moneySchema,
    deposit: moneySchema.default(0),
    start_date: isoDateSchema,
    end_date: isoDateSchema.optional(),
    billing_cycle: billingCycleEnum.default("monthly"),
    billing_mode: billingModeEnum.default("prepaid"),
  })
  .refine((d) => !d.end_date || d.end_date >= d.start_date, {
    message: "end_date must be on or after start_date",
    path: ["end_date"],
  })

const updateSchema = z
  .object({
    rent_amount: moneySchema.optional(),
    deposit: moneySchema.optional(),
    start_date: isoDateSchema.optional(),
    end_date: isoDateSchema.nullable().optional(),
    billing_cycle: billingCycleEnum.optional(),
    billing_mode: billingModeEnum.optional(),
    status: z.enum(["active", "ended"]).optional(),
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: "At least one field is required",
  })

const endSchema = z.object({
  end_date: isoDateSchema.optional(),
})

const listQuerySchema = paginationSchema.extend({
  unit_id: uuidSchema.optional(),
  tenant_id: uuidSchema.optional(),
  status: z.enum(["active", "ended"]).optional(),
})

export const leasesRouter = Router()

// CREATE (verifies both unit and tenant belong to this landlord)
leasesRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const landlordId = getLandlordId(req)
    const body = createSchema.parse(req.body)

    await assertOwned("units", body.unit_id, landlordId, "Unit")
    await assertOwned("tenants", body.tenant_id, landlordId, "Tenant")

    const { data, error } = await supabase
      .from("leases")
      .insert({ ...body, landlord_id: landlordId, status: "active" })
      .select("*")
      .single()

    if (error) throw new ApiError(500, error.message)
    return sendOk(res, data, 201)
  })
)

// LIST (optional filters + pagination)
leasesRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const landlordId = getLandlordId(req)
    const q = listQuerySchema.parse(req.query)

    let query = supabase
      .from("leases")
      .select("*")
      .eq("landlord_id", landlordId)

    if (q.unit_id) query = query.eq("unit_id", q.unit_id)
    if (q.tenant_id) query = query.eq("tenant_id", q.tenant_id)
    if (q.status) query = query.eq("status", q.status)

    query = query.order("created_at", { ascending: false })

    if (q.limit != null) {
      const from = q.offset ?? 0
      query = query.range(from, from + q.limit - 1)
    }

    const { data, error } = await query
    if (error) throw new ApiError(500, error.message)
    return sendOk(res, data)
  })
)

// GET ONE
leasesRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const landlordId = getLandlordId(req)
    const { id } = idParamSchema.parse(req.params)

    const { data, error } = await supabase
      .from("leases")
      .select("*")
      .eq("landlord_id", landlordId)
      .eq("id", id)
      .maybeSingle()

    if (error) throw new ApiError(500, error.message)
    if (!data) throw new ApiError(404, "Lease not found")
    return sendOk(res, data)
  })
)

// UPDATE
leasesRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const landlordId = getLandlordId(req)
    const { id } = idParamSchema.parse(req.params)
    const body = updateSchema.parse(req.body)

    const { data, error } = await supabase
      .from("leases")
      .update(body)
      .eq("landlord_id", landlordId)
      .eq("id", id)
      .select("*")
      .maybeSingle()

    if (error) throw new ApiError(500, error.message)
    if (!data) throw new ApiError(404, "Lease not found")
    return sendOk(res, data)
  })
)

// END / DEACTIVATE
leasesRouter.post(
  "/:id/end",
  asyncHandler(async (req, res) => {
    const landlordId = getLandlordId(req)
    const { id } = idParamSchema.parse(req.params)
    const body = endSchema.parse(req.body ?? {})

    const { data, error } = await supabase
      .from("leases")
      .update({
        status: "ended",
        end_date: body.end_date ?? todayISODate(),
      })
      .eq("landlord_id", landlordId)
      .eq("id", id)
      .select("*")
      .maybeSingle()

    if (error) throw new ApiError(500, error.message)
    if (!data) throw new ApiError(404, "Lease not found")
    return sendOk(res, data)
  })
)
