import { Router } from "express"
import { z } from "zod"
import { supabase } from "../../lib/supabase"
import { getLandlordId } from "../../middleware/auth"
import { asyncHandler } from "../../utils/asyncHandler"
import { ApiError } from "../../utils/errors"
import { assertOwned } from "../../utils/ownership"
import { sendOk } from "../../utils/response"
import { idParamSchema, paginationSchema, uuidSchema } from "../../utils/validation"
import { esc, notifyAsync } from "../notifications/notify.service"

const statusEnum = z.enum(["open", "in_progress", "closed"])

// Human-readable labels for status-change notifications.
const STATUS_LABELS: Record<string, string> = {
  open: "Open",
  in_progress: "In progress",
  closed: "Closed",
}

const createSchema = z.object({
  unit_id: uuidSchema,
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
})

const updateStatusSchema = z.object({
  status: statusEnum,
})

const listQuerySchema = paginationSchema.extend({
  unit_id: uuidSchema.optional(),
  status: statusEnum.optional(),
})

export const maintenanceTicketsRouter = Router()

// CREATE (verifies the unit belongs to this landlord)
maintenanceTicketsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const landlordId = getLandlordId(req)
    const body = createSchema.parse(req.body)

    await assertOwned("units", body.unit_id, landlordId, "Unit")

    const { data, error } = await supabase
      .from("maintenance_tickets")
      .insert({ ...body, landlord_id: landlordId, status: "open" })
      .select("*")
      .single()

    if (error) throw new ApiError(500, error.message)

    // EVENT notification (fire-and-forget).
    notifyAsync({
      landlordId,
      type: "ticket_new",
      title: "🔧 New maintenance ticket",
      body: `<b>${esc(body.title)}</b> was reported.`,
    })

    return sendOk(res, data, 201)
  })
)

// LIST (optional filters + pagination)
maintenanceTicketsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const landlordId = getLandlordId(req)
    const q = listQuerySchema.parse(req.query)

    let query = supabase
      .from("maintenance_tickets")
      .select("*")
      .eq("landlord_id", landlordId)

    if (q.unit_id) query = query.eq("unit_id", q.unit_id)
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
maintenanceTicketsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const landlordId = getLandlordId(req)
    const { id } = idParamSchema.parse(req.params)

    const { data, error } = await supabase
      .from("maintenance_tickets")
      .select("*")
      .eq("landlord_id", landlordId)
      .eq("id", id)
      .maybeSingle()

    if (error) throw new ApiError(500, error.message)
    if (!data) throw new ApiError(404, "Maintenance ticket not found")
    return sendOk(res, data)
  })
)

// UPDATE STATUS
maintenanceTicketsRouter.patch(
  "/:id/status",
  asyncHandler(async (req, res) => {
    const landlordId = getLandlordId(req)
    const { id } = idParamSchema.parse(req.params)
    const body = updateStatusSchema.parse(req.body)

    const { data, error } = await supabase
      .from("maintenance_tickets")
      .update({ status: body.status })
      .eq("landlord_id", landlordId)
      .eq("id", id)
      .select("*")
      .maybeSingle()

    if (error) throw new ApiError(500, error.message)
    if (!data) throw new ApiError(404, "Maintenance ticket not found")

    // EVENT notification (fire-and-forget).
    notifyAsync({
      landlordId,
      type: "ticket_status",
      title: "🔧 Ticket status updated",
      body: `<b>${esc(String(data.title ?? "Ticket"))}</b> is now ${esc(
        STATUS_LABELS[body.status] ?? body.status
      )}.`,
    })

    return sendOk(res, data)
  })
)

// CLOSE (shortcut for status = closed)
maintenanceTicketsRouter.post(
  "/:id/close",
  asyncHandler(async (req, res) => {
    const landlordId = getLandlordId(req)
    const { id } = idParamSchema.parse(req.params)

    const { data, error } = await supabase
      .from("maintenance_tickets")
      .update({ status: "closed" })
      .eq("landlord_id", landlordId)
      .eq("id", id)
      .select("*")
      .maybeSingle()

    if (error) throw new ApiError(500, error.message)
    if (!data) throw new ApiError(404, "Maintenance ticket not found")

    // EVENT notification (fire-and-forget).
    notifyAsync({
      landlordId,
      type: "ticket_status",
      title: "🔧 Ticket status updated",
      body: `<b>${esc(String(data.title ?? "Ticket"))}</b> is now ${esc(
        STATUS_LABELS.closed || "Closed"
      )}.`,
    })

    return sendOk(res, data)
  })
)
