// Currency + date + text formatting helpers.
// Currency helpers show grouped rupees while typing and submit a clean number.

// Keep only digits and a single decimal point.
export function digitsOnly(input: string): string {
  const cleaned = input.replace(/[^\d.]/g, "")
  const parts = cleaned.split(".")
  if (parts.length <= 1) return parts[0] ?? ""
  return `${parts[0]}.${parts.slice(1).join("")}`
}

// Indian digit grouping: 1580000 -> "15,80,000", 15800 -> "15,800".
function groupIndian(intStr: string): string {
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

// For read-only display of a stored number: 15800 -> "₹15,800".
export function formatCurrency(value: number | null | undefined): string {
  if (value == null) return "—"
  const [intPart, decPart] = String(value).split(".")
  const grouped = groupIndian(intPart)
  return decPart ? `₹${grouped}.${decPart}` : `₹${grouped}`
}

// Alias that also accepts numeric strings from the API (numeric columns arrive
// as strings over the wire). 15800 / "15800" -> "₹15,800".
export function formatMoney(value: number | string | null | undefined): string {
  if (value == null || value === "") return "—"
  const n = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(n)) return "—"
  const [intPart, decPart] = String(n).split(".")
  const grouped = groupIndian(intPart)
  return decPart ? `₹${grouped}.${decPart}` : `₹${grouped}`
}

// Compact number with K / M / B / T suffixes, e.g. 1500 -> "1.5K",
// 2_400_000 -> "2.4M". One decimal, trailing ".0" trimmed.
export function formatCompact(
  value: number | string | null | undefined
): string {
  const n = Number(value ?? 0)
  if (!Number.isFinite(n)) return "0"
  const sign = n < 0 ? "-" : ""
  const abs = Math.abs(n)
  const withSuffix = (v: number, suffix: string) =>
    sign + v.toFixed(1).replace(/\.0$/, "") + suffix
  if (abs >= 1e12) return withSuffix(abs / 1e12, "T")
  if (abs >= 1e9) return withSuffix(abs / 1e9, "B")
  if (abs >= 1e6) return withSuffix(abs / 1e6, "M")
  if (abs >= 1e3) return withSuffix(abs / 1e3, "K")
  return sign + String(Math.round(abs))
}

// Money with a rupee symbol, compacted with K/M/B for large values so KPI
// tiles and totals stay readable. Amounts under 1,000 keep exact grouping.
export function formatMoneyCompact(
  value: number | string | null | undefined
): string {
  const n = Number(value ?? 0)
  if (!Number.isFinite(n)) return "₹0"
  const abs = Math.abs(n)
  if (abs < 1000) return formatMoney(n)
  return (n < 0 ? "-" : "") + "₹" + formatCompact(abs)
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
]

// Display a stored ISO date (YYYY-MM-DD) as "DD MMM YYYY", e.g. "10 Jul 2026".
// Returns "—" for empty and echoes the raw string if it isn't ISO-shaped.
export function formatDate(value: string | null | undefined): string {
  if (!value) return "—"
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (!m) return value
  const year = m[1]
  const monthIdx = Number(m[2]) - 1
  const day = Number(m[3])
  if (monthIdx < 0 || monthIdx > 11) return value
  return `${String(day).padStart(2, "0")} ${MONTHS[monthIdx]} ${year}`
}

// "in_progress" -> "In Progress"; "bank_transfer" -> "Bank Transfer".
export function titleCase(input: string): string {
  return String(input)
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ")
}
