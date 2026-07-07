import { Router } from "express"
import { z } from "zod"
import { supabase } from "../../lib/supabase"
import { getLandlordId } from "../../middleware/auth"
import { asyncHandler } from "../../utils/asyncHandler"
import { ApiError } from "../../utils/errors"
import { sendOk } from "../../utils/response"
import { idParamSchema } from "../../utils/validation"

const createSchema = z.object({
  name: z.string().min(1).max(200),
  address: z.string().max(500).optional(),
})

const updateSchema = createSchema
  .partial()
  .refine((d) => Object.keys(d).length > 0, {
    message: "At least one field is required",
  })

export const propertiesRouter = Router()

// CREATE
propertiesRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const landlordId = getLandlordId(req)
    const body = createSchema.parse(req.body)

    const { data, error } = await supabase
      .from("properties")
      .insert({ ...body, landlord_id: landlordId })
      .select("*")
      .single()

    if (error) throw new ApiError(500, error.message)
    return sendOk(res, data, 201)
  })
)

// LIST
propertiesRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const landlordId = getLandlordId(req)
    const { data, error } = await supabase
      .from("properties")
      .select("*")
      .eq("landlord_id", landlordId)
      .order("created_at", { ascending: false })

    if (error) throw new ApiError(500, error.message)
    return sendOk(res, data)
  })
)

// GET ONE
propertiesRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const landlordId = getLandlordId(req)
    const { id } = idParamSchema.parse(req.params)

    const { data, error } = await supabase
      .from("properties")
      .select("*")
      .eq("landlord_id", landlordId)
      .eq("id", id)
      .maybeSingle()

    if (error) throw new ApiError(500, error.message)
    if (!data) throw new ApiError(404, "Property not found")
    return sendOk(res, data)
  })
)

// UPDATE
propertiesRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const landlordId = getLandlordId(req)
    const { id } = idParamSchema.parse(req.params)
    const body = updateSchema.parse(req.body)

    const { data, error } = await supabase
      .from("properties")
      .update(body)
      .eq("landlord_id", landlordId)
      .eq("id", id)
      .select("*")
      .maybeSingle()

    if (error) throw new ApiError(500, error.message)
    if (!data) throw new ApiError(404, "Property not found")
    return sendOk(res, data)
  })
)

// DELETE
propertiesRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const landlordId = getLandlordId(req)
    const { id } = idParamSchema.parse(req.params)

    const { data, error } = await supabase
      .from("properties")
      .delete()
      .eq("landlord_id", landlordId)
      .eq("id", id)
      .select("id")
      .maybeSingle()

    if (error) throw new ApiError(500, error.message)
    if (!data) throw new ApiError(404, "Property not found")
    return sendOk(res, { id: data.id, deleted: true })
  })
)
