import { Router } from "express"
import { z } from "zod"
import { supabase } from "../../lib/supabase"
import { getLandlordId } from "../../middleware/auth"
import { asyncHandler } from "../../utils/asyncHandler"
import { ApiError } from "../../utils/errors"
import { sendOk } from "../../utils/response"

const updateProfileSchema = z
  .object({
    full_name: z.string().min(1).max(200).optional(),
    phone: z.string().max(50).optional(),
    email: z.string().email().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: "At least one field is required",
  })

export const profileRouter = Router()

// GET /api/v1/me — current landlord profile (auto-created by auth middleware).
profileRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const landlordId = getLandlordId(req)
    const { data, error } = await supabase
      .from("landlords")
      .select("*")
      .eq("id", landlordId)
      .maybeSingle()

    if (error) throw new ApiError(500, error.message)
    if (!data) throw new ApiError(404, "Landlord profile not found")
    return sendOk(res, data)
  })
)

// PATCH /api/v1/me — update current landlord profile.
profileRouter.patch(
  "/",
  asyncHandler(async (req, res) => {
    const landlordId = getLandlordId(req)
    const body = updateProfileSchema.parse(req.body)

    const { data, error } = await supabase
      .from("landlords")
      .update(body)
      .eq("id", landlordId)
      .select("*")
      .maybeSingle()

    if (error) throw new ApiError(500, error.message)
    if (!data) throw new ApiError(404, "Landlord profile not found")
    return sendOk(res, data)
  })
)
