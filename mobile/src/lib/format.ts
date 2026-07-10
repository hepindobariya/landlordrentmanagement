// Currency helpers: show grouped rupees while typing, submit a clean number.

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
