// Formatting helpers. We do Indian-style digit grouping manually rather than
// relying on Intl/toLocaleString, which is not guaranteed on all Hermes builds.

export function formatMoney(value: number | string | null | undefined): string {
  const n = Math.round(Number(value ?? 0))
  if (!Number.isFinite(n)) return "\u20B90"

  const negative = n < 0
  const digits = String(Math.abs(n))

  // Indian grouping: last 3 digits, then groups of 2.
  let last3 = digits.slice(-3)
  let rest = digits.slice(0, -3)
  if (rest.length > 0) {
    rest = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",")
    last3 = "," + last3
  }

  return (negative ? "-" : "") + "\u20B9" + rest + last3
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "\u2014"
  // Values are YYYY-MM-DD; render as DD MMM YYYY without timezone drift.
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (!match) return value
  const [, y, m, d] = match
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ]
  const monthName = months[Number(m) - 1] ?? m
  return `${Number(d)} ${monthName} ${y}`
}

export function titleCase(value: string): string {
  return value
    .split(/[_\s]+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ")
}
