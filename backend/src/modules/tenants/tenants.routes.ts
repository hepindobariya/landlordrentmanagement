import { Router } from "express"
import { z } from "zod"
import { supabase } from "../../lib/supabase"
import { getLandlordId } from "../../middleware/auth"
import { asyncHandler } from "../../utils/asyncHandler"
import { ApiError } from "../../utils/errors"
import { sendOk } from "../../utils/response"
import {
  idParamSchema,
  paginationSchema,
  sanitizeSearch,
} from "../../utils/validation"

const createSchema = z.object({
  full_name: z.string().min(1).max(200),
  email: z.string().email().optional(),
  phone: z.string().max(50).optional(),
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

    const { data, error } = await supabase
      .from("tenants")
      .insert({ ...body, landlord_id: landlordId })
      .select("*")
      .single()

    if (error) throw new ApiError(500, error.message)
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

    const { data, error } = await supabase
      .from("tenants")
      .update(body)
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
