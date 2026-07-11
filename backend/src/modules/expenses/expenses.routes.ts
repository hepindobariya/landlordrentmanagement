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
  roundMoney,
  uuidSchema,
} from "../../utils/validation"

// Expense categories mirror the columns landlords track for a property P&L
// (RentGet / RMS-inspired). "other" is the catch-all.
const categoryEnum = z.enum([
  "mortgage",
  "taxes",
  "insurance",
  "repairs",
  "landscape",
  "pest_control",
  "management_fee",
  "appliance",
  "utilities",
  "other",
])

const recurEnum = z.enum(["monthly", "quarterly", "yearly"])

// Shared field shapes. create requires an amount; update makes every field
// optional so a PATCH can touch a single column.
const baseShape = {
  property_id: uuidSchema.nullable().optional(),
  lease_id: uuidSchema.nullable().optional(),
  category: categoryEnum.optional(),
  title: z.string().max(200).nullable().optional(),
  spent_on: isoDateSchema.optional(),
  is_recurring: z.boolean().optional(),
  recur_interval: recurEnum.nullable().optional(),
  tenant_payable: z.boolean().optional(),
  paid: z.boolean().optional(),
  receipt_url: z.string().max(500).nullable().optional(),
  remarks: z.string().max(1000).nullable().optional(),
}

const createSchema = z.object({
  ...baseShape,
  amount: moneySchema,
})

const updateSchema = z.object({
  ...baseShape,
  amount: moneySchema.optional(),
})

const boolParam = z.enum(["true", "false"]).optional()

const listQuerySchema = paginationSchema.extend({
  property_id: uuidSchema.optional(),
  lease_id: uuidSchema.optional(),
  category: categoryEnum.optional(),
  paid: boolParam,
  tenant_payable: boolParam,
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
})

const summaryQuerySchema = z.object({
  property_id: uuidSchema.optional(),
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
})

export const expensesRouter = Router()

// Verify optional parent references belong to this landlord.
async function assertParents(
  body: { property_id?: string | null; lease_id?: string | null },
  landlordId: string
): Promise<void> {
  if (body.property_id) {
    await assertOwned("properties", body.property_id, landlordId, "Property")
  }
  if (body.lease_id) {
    await assertOwned("leases", body.lease_id, landlordId, "Lease")
  }
}

// CREATE an expense.
expensesRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const landlordId = getLandlordId(req)
    const body = createSchema.parse(req.body)
    await assertParents(body, landlordId)

    const { data, error } = await supabase
      .from("expenses")
      .insert({
        landlord_id: landlordId,
        property_id: body.property_id ?? null,
        lease_id: body.lease_id ?? null,
        category: body.category ?? "other",
        title: body.title ?? null,
        amount: roundMoney(body.amount),
        spent_on: body.spent_on ?? todayISODate(),
        is_recurring: body.is_recurring ?? false,
        recur_interval: body.is_recurring ? body.recur_interval ?? null : null,
        tenant_payable: body.tenant_payable ?? false,
        paid: body.paid ?? true,
        receipt_url: body.receipt_url ?? null,
        remarks: body.remarks ?? null,
      })
      .select("*")
      .single()

    if (error) throw new ApiError(500, error.message)
    return sendOk(res, data, 201)
  })
)

// SUMMARY: totals for the current filter plus a per-category breakdown.
// Computed in JS from landlord-scoped rows (same approach as the calendar).
// Registered before "/:id" so the literal path wins.
expensesRouter.get(
  "/summary",
  asyncHandler(async (req, res) => {
    const landlordId = getLandlordId(req)
    const q = summaryQuerySchema.parse(req.query)

    let query = supabase
      .from("expenses")
      .select("category, amount, paid, tenant_payable, spent_on")
      .eq("landlord_id", landlordId)

    if (q.property_id) query = query.eq("property_id", q.property_id)
    if (q.from) query = query.gte("spent_on", q.from)
    if (q.to) query = query.lte("spent_on", q.to)

    const { data, error } = await query
    if (error) throw new ApiError(500, error.message)

    const rows = data ?? []
    const byCategory = new Map<string, number>()
    let total = 0
    let paidTotal = 0
    let unpaidTotal = 0
    let tenantPayableTotal = 0

    for (const r of rows) {
      const amt = roundMoney(Number(r.amount))
      total = roundMoney(total + amt)
      if (r.paid) paidTotal = roundMoney(paidTotal + amt)
      else unpaidTotal = roundMoney(unpaidTotal + amt)
      if (r.tenant_payable) {
        tenantPayableTotal = roundMoney(tenantPayableTotal + amt)
      }
      byCategory.set(
        r.category,
        roundMoney((byCategory.get(r.category) ?? 0) + amt)
      )
    }

    const by_category = [...byCategory.entries()]
      .map(([category, amount]) => ({ category, total: amount }))
      .sort((a, b) => b.total - a.total)

    return sendOk(res, {
      total,
      paid_total: paidTotal,
      unpaid_total: unpaidTotal,
      tenant_payable_total: tenantPayableTotal,
      count: rows.length,
      by_category,
    })
  })
)

// LIST expenses (newest first) with optional filters + pagination.
expensesRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const landlordId = getLandlordId(req)
    const q = listQuerySchema.parse(req.query)

    if (q.property_id) {
      await assertOwned("properties", q.property_id, landlordId, "Property")
    }
    if (q.lease_id) {
      await assertOwned("leases", q.lease_id, landlordId, "Lease")
    }

    let query = supabase
      .from("expenses")
      .select("*")
      .eq("landlord_id", landlordId)

    if (q.property_id) query = query.eq("property_id", q.property_id)
    if (q.lease_id) query = query.eq("lease_id", q.lease_id)
    if (q.category) query = query.eq("category", q.category)
    if (q.paid) query = query.eq("paid", q.paid === "true")
    if (q.tenant_payable) {
      query = query.eq("tenant_payable", q.tenant_payable === "true")
    }
    if (q.from) query = query.gte("spent_on", q.from)
    if (q.to) query = query.lte("spent_on", q.to)

    query = query.order("spent_on", { ascending: false })

    if (q.limit != null) {
      const from = q.offset ?? 0
      query = query.range(from, from + q.limit - 1)
    }

    const { data, error } = await query
    if (error) throw new ApiError(500, error.message)
    return sendOk(res, data)
  })
)

// GET one expense.
expensesRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const landlordId = getLandlordId(req)
    const { id } = idParamSchema.parse(req.params)

    const { data, error } = await supabase
      .from("expenses")
      .select("*")
      .eq("landlord_id", landlordId)
      .eq("id", id)
      .maybeSingle()

    if (error) throw new ApiError(500, error.message)
    if (!data) throw new ApiError(404, "Expense not found")
    return sendOk(res, data)
  })
)

// UPDATE an expense (partial).
expensesRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const landlordId = getLandlordId(req)
    const { id } = idParamSchema.parse(req.params)
    const body = updateSchema.parse(req.body ?? {})
    await assertParents(body, landlordId)

    const updates: Record<string, unknown> = {}
    if (body.property_id !== undefined) updates.property_id = body.property_id
    if (body.lease_id !== undefined) updates.lease_id = body.lease_id
    if (body.category !== undefined) updates.category = body.category
    if (body.title !== undefined) updates.title = body.title
    if (body.amount !== undefined) updates.amount = roundMoney(body.amount)
    if (body.spent_on !== undefined) updates.spent_on = body.spent_on
    if (body.is_recurring !== undefined) {
      updates.is_recurring = body.is_recurring
    }
    if (body.recur_interval !== undefined) {
      updates.recur_interval = body.recur_interval
    }
    if (body.tenant_payable !== undefined) {
      updates.tenant_payable = body.tenant_payable
    }
    if (body.paid !== undefined) updates.paid = body.paid
    if (body.receipt_url !== undefined) updates.receipt_url = body.receipt_url
    if (body.remarks !== undefined) updates.remarks = body.remarks

    // Keep recur_interval consistent when recurring is switched off.
    if (body.is_recurring === false) updates.recur_interval = null

    if (Object.keys(updates).length === 0) {
      throw new ApiError(400, "No fields to update")
    }

    const { data, error } = await supabase
      .from("expenses")
      .update(updates)
      .eq("landlord_id", landlordId)
      .eq("id", id)
      .select("*")
      .maybeSingle()

    if (error) throw new ApiError(500, error.message)
    if (!data) throw new ApiError(404, "Expense not found")
    return sendOk(res, data)
  })
)

// DELETE an expense.
expensesRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const landlordId = getLandlordId(req)
    const { id } = idParamSchema.parse(req.params)

    const { data, error } = await supabase
      .from("expenses")
      .delete()
      .eq("landlord_id", landlordId)
      .eq("id", id)
      .select("id")
      .maybeSingle()

    if (error) throw new ApiError(500, error.message)
    if (!data) throw new ApiError(404, "Expense not found")
    return sendOk(res, { id: data.id })
  })
)
