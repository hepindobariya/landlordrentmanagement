import { Router } from "express"
import { z } from "zod"
import { supabase } from "../../lib/supabase"
import { getLandlordId } from "../../middleware/auth"
import { asyncHandler } from "../../utils/asyncHandler"
import { ApiError } from "../../utils/errors"
import { assertOwned } from "../../utils/ownership"
import { sendOk } from "../../utils/response"
import {
  idParamSchema,
  paginationSchema,
  sanitizeSearch,
  uuidSchema,
} from "../../utils/validation"
import { esc, notifyAsync } from "../notifications/notify.service"

const verificationStatusEnum = z.enum([
  "unverified",
  "pending",
  "verified",
  "failed",
])

const createSchema = z.object({
  full_name: z.string().min(1).max(200),
  email: z.string().email().optional(),
  phone: z.string().max(50).optional(),
  pan: z.string().max(20).optional(),
  aadhaar_last4: z.string().regex(/^\d{4}$/, "Enter the last 4 digits").optional(),
  verification_status: verificationStatusEnum.optional(),
})

const updateSchema = createSchema
  .partial()
  .refine((d) => Object.keys(d).length > 0, {
    message: "At least one field is required",
  })

const listQuerySchema = paginationSchema.extend({
  search: z.string().min(1).max(200).optional(),
})

export const tenantsRouter = Router()

// CREATE
tenantsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const landlordId = getLandlordId(req)
    const body = createSchema.parse(req.body)

    const insert: Record<string, unknown> = { ...body, landlord_id: landlordId }
    if (body.verification_status === "verified") {
      insert.verified_at = new Date().toISOString()
    }

    const { data, error } = await supabase
      .from("tenants")
      .insert(insert)
      .select("*")
      .single()

    if (error) throw new ApiError(500, error.message)

    // EVENT notification (fire-and-forget) — new tenant / occupancy change.
    notifyAsync({
      landlordId,
      type: "tenant_change",
      title: "👤 New tenant added",
      body: `<b>${esc(body.full_name)}</b> was added to your tenants.`,
    })

    return sendOk(res, data, 201)
  })
)

// LIST (optional ?search=, ?limit=, ?offset=)
tenantsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const landlordId = getLandlordId(req)
    const { search, limit, offset } = listQuerySchema.parse(req.query)

    let query = supabase
      .from("tenants")
      .select("*")
      .eq("landlord_id", landlordId)

    if (search) {
      const s = sanitizeSearch(search)
      if (s) {
        query = query.or(
          `full_name.ilike.%${s}%,email.ilike.%${s}%,phone.ilike.%${s}%`
        )
      }
    }

    query = query.order("created_at", { ascending: false })

    if (limit != null) {
      const from = offset ?? 0
      query = query.range(from, from + limit - 1)
    }

    const { data, error } = await query
    if (error) throw new ApiError(500, error.message)
    return sendOk(res, data)
  })
)

// GET ONE
tenantsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const landlordId = getLandlordId(req)
    const { id } = idParamSchema.parse(req.params)

    const { data, error } = await supabase
      .from("tenants")
      .select("*")
      .eq("landlord_id", landlordId)
      .eq("id", id)
      .maybeSingle()

    if (error) throw new ApiError(500, error.message)
    if (!data) throw new ApiError(404, "Tenant not found")
    return sendOk(res, data)
  })
)

// UPDATE
tenantsRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const landlordId = getLandlordId(req)
    const { id } = idParamSchema.parse(req.params)
    const body = updateSchema.parse(req.body)

    const patch: Record<string, unknown> = { ...body }
    if (body.verification_status === "verified") {
      patch.verified_at = new Date().toISOString()
    } else if (body.verification_status != null) {
      patch.verified_at = null
    }

    const { data, error } = await supabase
      .from("tenants")
      .update(patch)
      .eq("landlord_id", landlordId)
      .eq("id", id)
      .select("*")
      .maybeSingle()

    if (error) throw new ApiError(500, error.message)
    if (!data) throw new ApiError(404, "Tenant not found")
    return sendOk(res, data)
  })
)

// DELETE
tenantsRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const landlordId = getLandlordId(req)
    const { id } = idParamSchema.parse(req.params)

    const { data, error } = await supabase
      .from("tenants")
      .delete()
      .eq("landlord_id", landlordId)
      .eq("id", id)
      .select("id")
      .maybeSingle()

    if (error) throw new ApiError(500, error.message)
    if (!data) throw new ApiError(404, "Tenant not found")
    return sendOk(res, { id: data.id, deleted: true })
  })
)

// --- Co-tenants & references (Batch 5) ------------------------------------
const personSchema = z.object({
  full_name: z.string().min(1).max(200),
  relation: z.string().max(100).optional(),
  phone: z.string().max(50).optional(),
  email: z.string().email().optional(),
})
const coTenantSchema = personSchema.extend({
  same_address: z.boolean().optional(),
})
const childParamsSchema = z.object({ id: uuidSchema, childId: uuidSchema })

// LIST co-tenants for a tenant
tenantsRouter.get(
  "/:id/co-tenants",
  asyncHandler(async (req, res) => {
    const landlordId = getLandlordId(req)
    const { id } = idParamSchema.parse(req.params)
    await assertOwned("tenants", id, landlordId, "Tenant")
    const { data, error } = await supabase
      .from("co_tenants")
      .select("*")
      .eq("landlord_id", landlordId)
      .eq("tenant_id", id)
      .order("created_at", { ascending: true })
    if (error) throw new ApiError(500, error.message)
    return sendOk(res, data)
  })
)

// ADD a co-tenant
tenantsRouter.post(
  "/:id/co-tenants",
  asyncHandler(async (req, res) => {
    const landlordId = getLandlordId(req)
    const { id } = idParamSchema.parse(req.params)
    await assertOwned("tenants", id, landlordId, "Tenant")
    const body = coTenantSchema.parse(req.body)
    const { data, error } = await supabase
      .from("co_tenants")
      .insert({ ...body, tenant_id: id, landlord_id: landlordId })
      .select("*")
      .single()
    if (error) throw new ApiError(500, error.message)
    return sendOk(res, data, 201)
  })
)

// DELETE a co-tenant
tenantsRouter.delete(
  "/:id/co-tenants/:childId",
  asyncHandler(async (req, res) => {
    const landlordId = getLandlordId(req)
    const { id, childId } = childParamsSchema.parse(req.params)
    const { data, error } = await supabase
      .from("co_tenants")
      .delete()
      .eq("landlord_id", landlordId)
      .eq("tenant_id", id)
      .eq("id", childId)
      .select("id")
      .maybeSingle()
    if (error) throw new ApiError(500, error.message)
    if (!data) throw new ApiError(404, "Co-tenant not found")
    return sendOk(res, { id: data.id, deleted: true })
  })
)

// LIST references for a tenant
tenantsRouter.get(
  "/:id/references",
  asyncHandler(async (req, res) => {
    const landlordId = getLandlordId(req)
    const { id } = idParamSchema.parse(req.params)
    await assertOwned("tenants", id, landlordId, "Tenant")
    const { data, error } = await supabase
      .from("tenant_references")
      .select("*")
      .eq("landlord_id", landlordId)
      .eq("tenant_id", id)
      .order("created_at", { ascending: true })
    if (error) throw new ApiError(500, error.message)
    return sendOk(res, data)
  })
)

// ADD a reference
tenantsRouter.post(
  "/:id/references",
  asyncHandler(async (req, res) => {
    const landlordId = getLandlordId(req)
    const { id } = idParamSchema.parse(req.params)
    await assertOwned("tenants", id, landlordId, "Tenant")
    const body = personSchema.parse(req.body)
    const { data, error } = await supabase
      .from("tenant_references")
      .insert({ ...body, tenant_id: id, landlord_id: landlordId })
      .select("*")
      .single()
    if (error) throw new ApiError(500, error.message)
    return sendOk(res, data, 201)
  })
)

// DELETE a reference
tenantsRouter.delete(
  "/:id/references/:childId",
  asyncHandler(async (req, res) => {
    const landlordId = getLandlordId(req)
    const { id, childId } = childParamsSchema.parse(req.params)
    const { data, error } = await supabase
      .from("tenant_references")
      .delete()
      .eq("landlord_id", landlordId)
      .eq("tenant_id", id)
      .eq("id", childId)
      .select("id")
      .maybeSingle()
    if (error) throw new ApiError(500, error.message)
    if (!data) throw new ApiError(404, "Reference not found")
    return sendOk(res, { id: data.id, deleted: true })
  })
)
