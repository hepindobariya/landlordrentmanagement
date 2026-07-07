// Small date helpers used for rent charge generation and payments.
// All values are UTC-based YYYY-MM-DD strings to match Postgres `date`.

export function todayISODate(): string {
  return new Date().toISOString().slice(0, 10)
}

export function firstDayOfCurrentMonthISO(): string {
  const now = new Date()
  const year = now.getUTCFullYear()
  const month = String(now.getUTCMonth() + 1).padStart(2, "0")
  return `${year}-${month}-01`
}
