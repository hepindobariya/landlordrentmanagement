import crypto from "crypto"
import { Router } from "express"
import { z } from "zod"
import { env } from "../../config/env"
import { supabase } from "../../lib/supabase"
import { getLandlordId } from "../../middleware/auth"
import { asyncHandler } from "../../utils/asyncHandler"
import { ApiError } from "../../utils/errors"
import { sendOk } from "../../utils/response"
import { getOrCreateSettings } from "./notify.service"

const updateSettingsSchema = z.object({
  notify_payment: z.boolean().optional(),
  notify_partial: z.boolean().optional(),
  notify_due: z.boolean().optional(),
  notify_overdue: z.boolean().optional(),
  notify_ticket_new: z.boolean().optional(),
  notify_ticket_status: z.boolean().optional(),
  notify_lease_new: z.boolean().optional(),
  notify_lease_expiring: z.boolean().optional(),
  notify_tenant_change: z.boolean().optional(),
  notify_summary: z.boolean().optional(),
  summary_frequency: z.enum(["off", "daily", "weekly"]).optional(),
})

export const notificationsRouter = Router()

// GET /settings
notificationsRouter.get(
  "/settings",
  asyncHandler(async (req, res) => {
    const landlordId = getLandlordId(req)
    const settings = await getOrCreateSettings(landlordId)
    return sendOk(res, settings)
  })
)

// PATCH /settings
notificationsRouter.patch(
  "/settings",
  asyncHandler(async (req, res) => {
    const landlordId = getLandlordId(req)
    const body = updateSettingsSchema.parse(req.body)

    // Ensure settings row exists first
    await getOrCreateSettings(landlordId)

    const { data, error } = await supabase
      .from("notification_settings")
      .update({
        ...body,
        updated_at: new Date().toISOString(),
      })
      .eq("landlord_id", landlordId)
      .select("*")
      .single()

    if (error) throw new ApiError(500, error.message)
    return sendOk(res, data)
  })
)

// POST /telegram/link
notificationsRouter.post(
  "/telegram/link",
  asyncHandler(async (req, res) => {
    const landlordId = getLandlordId(req)
    const botUsername = env.TELEGRAM_BOT_USERNAME
    if (!botUsername) {
      throw new ApiError(500, "TELEGRAM_BOT_USERNAME is not configured")
    }

    // Generate link token
    const token = crypto.randomUUID()

    // Ensure settings row exists
    await getOrCreateSettings(landlordId)

    const { error } = await supabase
      .from("notification_settings")
      .update({
        telegram_link_token: token,
        updated_at: new Date().toISOString(),
      })
      .eq("landlord_id", landlordId)

    if (error) throw new ApiError(500, error.message)

    const deepLink = `https://t.me/${botUsername}?start=${token}`
    return sendOk(res, { deep_link: deepLink, bot_username: botUsername })
  })
)

// POST /telegram/unlink
notificationsRouter.post(
  "/telegram/unlink",
  asyncHandler(async (req, res) => {
    const landlordId = getLandlordId(req)

    // Ensure settings row exists
    await getOrCreateSettings(landlordId)

    const { data, error } = await supabase
      .from("notification_settings")
      .update({
        telegram_linked: false,
        telegram_chat_id: null,
        telegram_link_token: null,
        updated_at: new Date().toISOString(),
      })
      .eq("landlord_id", landlordId)
      .select("*")
      .single()

    if (error) throw new ApiError(500, error.message)
    return sendOk(res, data)
  })
)
