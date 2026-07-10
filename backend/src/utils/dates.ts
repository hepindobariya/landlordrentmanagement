// Small date helpers used for rent charge generation, payments, and reports.
// All values are YYYY-MM-DD strings computed in the business timezone
// (default Asia/Kolkata, configurable via APP_TIMEZONE) so an India-based
// landlord never sees off-by-one dates caused by UTC drift after midnight
// local time. Postgres `date` columns are timezone-agnostic YYYY-MM-DD.
import { env } from "../config/env"

// Format a Date as YYYY-MM-DD in the given IANA timezone.
// en-CA locale renders dates as YYYY-MM-DD, and an explicit timeZone avoids
// the UTC drift you get from Date.prototype.toISOString().
function isoDateInTimeZone(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date)
}

export function todayISODate(): string {
  return isoDateInTimeZone(new Date(), env.APP_TIMEZONE)
}

export function firstDayOfCurrentMonthISO(): string {
  // Reuse today's business-timezone date and pin to the 1st of that month.
  return `${todayISODate().slice(0, 7)}-01`
}

// [start, end) YYYY-MM-DD bounds of the current business-timezone month.
// A charge belongs to "this month" when start <= due_date < end.
export function currentMonthBoundsISO(): { start: string; end: string } {
  const today = todayISODate()
  const year = Number(today.slice(0, 4))
  const month = Number(today.slice(5, 7)) // 1-12
  const start = `${today.slice(0, 7)}-01`
  const nextYear = month === 12 ? year + 1 : year
  const nextMonth = month === 12 ? 1 : month + 1
  const end = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`
  return { start, end }
}
