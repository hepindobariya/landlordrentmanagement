import { supabase } from "../../lib/supabase"
import {
  esc,
  formatINR,
  notify,
  type NotificationSettings,
} from "./notify.service"

// Tunable windows for time-based reminders.
const DUE_SOON_DAYS = 3 // rent due within N days
const LEASE_EXPIRY_DAYS = 14 // lease ending within N days

// UTC YYYY-MM-DD for "today".
function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

// Add (or subtract) whole days to a YYYY-MM-DD string, returning YYYY-MM-DD.
function addDaysISO(base: string, days: number): string {
  const parts = base.split("-").map(Number)
  const y = parts[0] || 2026
  const m = parts[1] || 1
  const d = parts[2] || 1
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + days)
  return dt.toISOString().slice(0, 10)
}

type ChargeRow = {
  id: string
  lease_id: string
  amount: number | string
  amount_paid: number | string
  due_date: string
  status: string
}

type LeaseRow = {
  id: string
  end_date: string | null
  rent_amount: number | string
}

/**
 * Runs all TIME-BASED notifications for every landlord who has linked Telegram.
 * Idempotent within a day via notify()'s dedupe (same type + title + "sent").
 */
export async function runTimeBasedNotifications(): Promise<{
  landlords: number
  sent: number
}> {
  const today = todayISO()
  const dow = new Date().getUTCDay() // 0 = Sunday, 1 = Monday …

  const { data: settingsList, error } = await supabase
    .from("notification_settings")
    .select("*")
    .eq("telegram_linked", true)

  if (error) throw new Error(error.message)

  let sent = 0
  const linked = (settingsList ?? []) as NotificationSettings[]

  for (const s of linked) {
    const landlordId = s.landlord_id

    // --- Rent due soon (due within N days, still due/partial) ---
    if (s.notify_due) {
      const soon = addDaysISO(today, DUE_SOON_DAYS)
      const { data: charges } = await supabase
        .from("rent_charges")
        .select("id, lease_id, amount, amount_paid, due_date, status")
        .eq("landlord_id", landlordId)
        .in("status", ["due", "partial"])
        .gte("due_date", today)
        .lte("due_date", soon)

      for (const c of (charges ?? []) as ChargeRow[]) {
        const remaining = Number(c.amount) - Number(c.amount_paid ?? 0)
        if (remaining <= 0) continue
        const r = await notify({
          landlordId,
          type: "due",
          title: `⏰ Rent due soon — due ${c.due_date}`,
          body: `${formatINR(remaining)} is due on <b>${esc(c.due_date)}</b>.`,
          dedupe: true,
        })
        if (r.status === "sent") sent++
      }
    }

    // --- Overdue rent (past due date, still due/partial) ---
    if (s.notify_overdue) {
      const { data: charges } = await supabase
        .from("rent_charges")
        .select("id, lease_id, amount, amount_paid, due_date, status")
        .eq("landlord_id", landlordId)
        .in("status", ["due", "partial"])
        .lt("due_date", today)

      for (const c of (charges ?? []) as ChargeRow[]) {
        const remaining = Number(c.amount) - Number(c.amount_paid ?? 0)
        if (remaining <= 0) continue
        const r = await notify({
          landlordId,
          type: "overdue",
          title: `🚨 Overdue rent — was due ${c.due_date}`,
          body: `${formatINR(remaining)} is overdue (was due <b>${esc(
            c.due_date
          )}</b>).`,
          dedupe: true,
        })
        if (r.status === "sent") sent++
      }
    }

    // --- Lease expiring soon (active, end_date within N days) ---
    if (s.notify_lease_expiring) {
      const soon = addDaysISO(today, LEASE_EXPIRY_DAYS)
      const { data: leases } = await supabase
        .from("leases")
        .select("id, end_date, rent_amount")
        .eq("landlord_id", landlordId)
        .eq("status", "active")
        .not("end_date", "is", null)
        .gte("end_date", today)
        .lte("end_date", soon)

      for (const l of (leases ?? []) as LeaseRow[]) {
        const r = await notify({
          landlordId,
          type: "lease_expiring",
          title: `📄 Lease expiring — ends ${l.end_date}`,
          body: `A lease is ending on <b>${esc(
            l.end_date ?? ""
          )}</b>. Consider renewing or ending it.`,
          dedupe: true,
        })
        if (r.status === "sent") sent++
      }
    }

    // --- Daily / weekly summary (honoring summary_frequency) ---
    if (s.notify_summary && s.summary_frequency !== "off") {
      const freq = s.summary_frequency
      const runNow = freq === "daily" || (freq === "weekly" && dow === 1)
      if (runNow) {
        const periodStart = freq === "weekly" ? addDaysISO(today, -6) : today

        const [{ data: payments }, { data: charges }] = await Promise.all([
          supabase
            .from("payments")
            .select("amount, paid_date")
            .eq("landlord_id", landlordId)
            .gte("paid_date", periodStart)
            .lte("paid_date", today),
          supabase
            .from("rent_charges")
            .select("amount, due_date")
            .eq("landlord_id", landlordId)
            .gte("due_date", periodStart)
            .lte("due_date", today),
        ])

        const collected = (payments ?? []).reduce(
          (a, p) => a + Number((p as { amount: number | string }).amount ?? 0),
          0
        )
        const billed = (charges ?? []).reduce(
          (a, c) => a + Number((c as { amount: number | string }).amount ?? 0),
          0
        )

        const label =
          freq === "weekly"
            ? `Weekly summary (${periodStart} → ${today})`
            : `Daily summary (${today})`

        const r = await notify({
          landlordId,
          type: "summary",
          title: `📊 ${label}`,
          body:
            `Collected: <b>${formatINR(collected)}</b>\n` +
            `Billed: <b>${formatINR(billed)}</b>`,
          dedupe: true,
        })
        if (r.status === "sent") sent++
      }
    }
  }

  return { landlords: linked.length, sent }
}
