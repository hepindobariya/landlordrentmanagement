import { supabase } from "../../lib/supabase"
import { sendTelegramMessage } from "../../lib/telegram"

export type NotificationType =
  | "payment"
  | "partial"
  | "due"
  | "overdue"
  | "ticket_new"
  | "ticket_status"
  | "lease_new"
  | "lease_expiring"
  | "tenant_change"
  | "summary"

// Maps each notification type to its toggle column on notification_settings.
export const TOGGLE_COLUMN: Record<NotificationType, keyof NotificationSettings> = {
  payment: "notify_payment",
  partial: "notify_partial",
  due: "notify_due",
  overdue: "notify_overdue",
  ticket_new: "notify_ticket_new",
  ticket_status: "notify_ticket_status",
  lease_new: "notify_lease_new",
  lease_expiring: "notify_lease_expiring",
  tenant_change: "notify_tenant_change",
  summary: "notify_summary",
}

export type NotificationSettings = {
  landlord_id: string
  telegram_chat_id: string | null
  telegram_link_token: string | null
  telegram_linked: boolean
  notify_payment: boolean
  notify_partial: boolean
  notify_due: boolean
  notify_overdue: boolean
  notify_ticket_new: boolean
  notify_ticket_status: boolean
  notify_lease_new: boolean
  notify_lease_expiring: boolean
  notify_tenant_change: boolean
  notify_summary: boolean
  summary_frequency: "off" | "daily" | "weekly"
  created_at?: string
  updated_at?: string
}

// Escape user-supplied text for Telegram HTML parse mode.
export function esc(input: string): string {
  return String(input)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
}

// Format a number as Indian rupees with grouping, e.g. 1580000 -> "₹15,80,000".
export function formatINR(value: number | string): string {
  const n = Number(value)
  if (!Number.isFinite(n)) return "₹0"
  const rounded = Math.round(n * 100) / 100
  const [intPartRaw, decPart] = String(Math.abs(rounded)).split(".")
  const intPart = intPartRaw ?? "0"
  let grouped: string
  if (intPart.length <= 3) {
    grouped = intPart
  } else {
    const last3 = intPart.slice(-3)
    const rest = intPart.slice(0, -3)
    grouped = `${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",")},${last3}`
  }
  const sign = rounded < 0 ? "-" : ""
  return decPart ? `${sign}₹${grouped}.${decPart}` : `${sign}₹${grouped}`
}

// Load a landlord's settings row (or null if it doesn't exist yet).
export async function readSettings(
  landlordId: string
): Promise<NotificationSettings | null> {
  const { data, error } = await supabase
    .from("notification_settings")
    .select("*")
    .eq("landlord_id", landlordId)
    .maybeSingle()
  if (error) {
    console.error("[notify] readSettings error:", error.message)
    return null
  }
  return (data as NotificationSettings) ?? null
}

// Load or lazily create a landlord's settings row with schema defaults.
export async function getOrCreateSettings(
  landlordId: string
): Promise<NotificationSettings> {
  const existing = await readSettings(landlordId)
  if (existing) return existing

  const { data, error } = await supabase
    .from("notification_settings")
    .upsert({ landlord_id: landlordId }, { onConflict: "landlord_id" })
    .select("*")
    .single()

  if (error) throw new Error(error.message)
  return data as NotificationSettings
}

export type NotifyResult = {
  status: "sent" | "skipped" | "failed"
  error?: string
}

type NotifyArgs = {
  landlordId: string
  type: NotificationType
  title: string
  body: string
  dedupe?: boolean
}

// Central send path. Never throws. Honors the per-type toggle + telegram link,
// sends via Telegram, and records a notification_log row.
export async function notify(args: NotifyArgs): Promise<NotifyResult> {
  const { landlordId, type, title, body, dedupe } = args
  try {
    const settings = await readSettings(landlordId)
    if (!settings) return { status: "skipped" }
    if (!settings.telegram_linked || !settings.telegram_chat_id) {
      return { status: "skipped" }
    }
    const toggleCol = TOGGLE_COLUMN[type]
    if (settings[toggleCol] === false) return { status: "skipped" }

    // Idempotency: skip if an identical alert already went out today.
    if (dedupe) {
      const startOfDay =
        new Date().toISOString().slice(0, 10) + "T00:00:00.000Z"
      const { data: existing } = await supabase
        .from("notification_log")
        .select("id")
        .eq("landlord_id", landlordId)
        .eq("type", type)
        .eq("title", title)
        .eq("status", "sent")
        .gte("created_at", startOfDay)
        .limit(1)
      if (existing && existing.length > 0) return { status: "skipped" }
    }

    const text = `<b>${esc(title)}</b>\n${body}`
    const result = await sendTelegramMessage(settings.telegram_chat_id, text)
    const ok = Boolean(result?.ok)
    const errorMsg = ok ? null : result?.error ?? "send failed"

    await supabase.from("notification_log").insert({
      landlord_id: landlordId,
      type,
      channel: "telegram",
      title,
      body,
      status: ok ? "sent" : "failed",
      error: errorMsg,
    })

    return ok ? { status: "sent" } : { status: "failed", error: errorMsg ?? undefined }
  } catch (e) {
    const message = e instanceof Error ? e.message : "notify failed"
    console.error("[notify] error:", message)
    return { status: "failed", error: message }
  }
}

// Fire-and-forget wrapper for use inside request handlers.
export function notifyAsync(args: NotifyArgs): void {
  void notify(args).catch((e) => {
    console.error("[notifyAsync] unexpected:", e)
  })
}
