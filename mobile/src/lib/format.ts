// Currency + date + text formatting helpers.
// Money fields can arrive as numbers OR strings (Postgres numeric over the wire),
// so every money helper accepts number | string | null | undefined.

// Keep only digits and a single decimal point.
export function digitsOnly(input: string): string {
  const cleaned = input.replace(/[^\d.]/g, "")
  const parts = cleaned.split(".")
  if (parts.length <= 1) return parts[0] ?? ""
  return `${parts[0]}.${parts.slice(1).join("")}`
}

// Indian digit grouping: 1580000 -> "15,80,000", 15800 -> "15,800".
export function groupIndian(intStr: string): string {
  const s = intStr.replace(/^0+(?=\d)/, "")
  if (s.length <= 3) return s === "" ? "0" : s
  const last3 = s.slice(-3)
  const rest = s.slice(0, -3)
  return `${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",")},${last3}`
}

// For a text input: "15800" -> "₹15,800" (keeps a trailing decimal as typed).
export function formatCurrencyInput(raw: string): string {
  const cleaned = digitsOnly(raw)
  if (cleaned === "") return ""
  const [intPart, decPart] = cleaned.split(".")
  const grouped = groupIndian(intPart || "0")
  return decPart !== undefined ? `₹${grouped}.${decPart}` : `₹${grouped}`
}

// For submitting to the backend: display/raw -> clean number (or null).
export function toNumber(raw: string): number | null {
  const cleaned = digitsOnly(raw)
  if (cleaned === "") return null
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}

// Canonical read-only money display: 15800 -> "₹15,800", "15800.5" -> "₹15,800.5".
export function formatMoney(value: number | string | null | undefined): string {
  if (value == null || value === "") return "—"
  const n = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(n)) return "—"
  const fixed = Math.round(n * 100) / 100
  const [intPart, decPart] = String(fixed).split(".")
  const grouped = groupIndian(intPart)
  return decPart ? `₹${grouped}.${decPart}` : `₹${grouped}`
}

// Backwards-compatible alias (older code imported formatCurrency).
export const formatCurrency = formatMoney

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
]

// "2026-07-10" -> "10 Jul 2026". Parsed manually to avoid timezone shifts.
export function formatDate(value: string | null | undefined): string {
  if (!value) return "—"
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (!m) return value
  const [, y, mo, d] = m
  const month = MONTHS[Number(mo) - 1] ?? mo
  return `${Number(d)} ${month} ${y}`
}

// "in_progress" -> "In Progress", "due" -> "Due".
export function titleCase(value: string | null | undefined): string {
  if (!value) return ""
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}