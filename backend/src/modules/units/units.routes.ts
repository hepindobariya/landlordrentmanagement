import { Router } from "express"
import { z } from "zod"
import { supabase } from "../../lib/supabase"
import { getLandlordId } from "../../middleware/auth"
import { asyncHandler } from "../../utils/asyncHandler"
import { ApiError } from "../../utils/errors"
import { assertOwned } from "../../utils/ownership"
import { sendOk } from "../../utils/response"
import { idParamSchema, paginationSchema, uuidSchema } from "../../utils/validation"

const createSchema = z.object({
  property_id: uuidSchema,
  unit_number: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  bedrooms: z.number().int().nonnegative().optional(),
  bathrooms: z.number().int().nonnegative().optional(),
})

const updateSchema = z
  .object({
    property_id: uuidSchema.optional(),
    unit_number: z.string().min(1).max(100).optional(),
    description: z.string().max(500).optional(),
    bedrooms: z.number().int().nonnegative().optional(),
    bathrooms: z.number().int().nonnegative().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: "At least one field is required",
  })

const listQuerySchema = paginationSchema.extend({
  property_id: uuidSchema.optional(),
})

export const unitsRouter = Router()

// CREATE (verifies the parent property belongs to this landlord)
unitsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const landlordId = getLandlordId(req)
    const body = createSchema.parse(req.body)

    await assertOwned("properties", body.property_id, landlordId, "Property")

    const { data, error } = await supabase
      .from("units")
      .insert({ ...body, landlord_id: landlordId })
      .select("*")
      .single()

    if (error) throw new ApiError(500, error.message)
    return sendOk(res, data, 201)
  })
)

// LIST (optional ?property_id= filter, ?limit=, ?offset=)
unitsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const landlordId = getLandlordId(req)
    const q = listQuerySchema.parse(req.query)

    let query = supabase
      .from("units")
      .select("*")
      .eq("landlord_id", landlordId)

    if (q.property_id) query = query.eq("property_id", q.property_id)

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
unitsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const landlordId = getLandlordId(req)
    const { id } = idParamSchema.parse(req.params)

    const { data, error } = await supabase
      .from("units")
      .select("*")
      .eq("landlord_id", landlordId)
      .eq("id", id)
      .maybeSingle()

    if (error) throw new ApiError(500, error.message)
    if (!data) throw new ApiError(404, "Unit not found")
    return sendOk(res, data)
  })
)

// UPDATE
unitsRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const landlordId = getLandlordId(req)
    const { id } = idParamSchema.parse(req.params)
    const body = updateSchema.parse(req.body)

    if (body.property_id) {
      await assertOwned("properties", body.property_id, landlordId, "Property")
    }

    const { data, error } = await supabase
      .from("units")
      .update(body)
      .eq("landlord_id", landlordId)
      .eq("id", id)
      .select("*")
      .maybeSingle()

    if (error) throw new ApiError(500, error.message)
    if (!data) throw new ApiError(404, "Unit not found")
    return sendOk(res, data)
  })
)

// DELETE
unitsRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const landlordId = getLandlordId(req)
    const { id } = idParamSchema.parse(req.params)

    const { data, error } = await supabase
      .from("units")
      .delete()
      .eq("landlord_id", landlordId)
      .eq("id", id)
      .select("id")
      .maybeSingle()

    if (error) throw new ApiError(500, error.message)
    if (!data) throw new ApiError(404, "Unit not found")
    return sendOk(res, { id: data.id, deleted: true })
  })
)
