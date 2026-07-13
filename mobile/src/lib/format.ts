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
  if (!Number.isFinite(n)) return "\u20B90"
  const abs = Math.abs(n)
  if (abs < 1000) return formatMoney(n)
  return (n < 0 ? "-" : "") + "\u20B9" + formatCompact(abs)
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "\u2014"
  // Values are YYYY-MM-DD; render as DD-MM-YYYY without timezone drift.
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (!match) return value
  const [, y, m, d] = match
  return `${d}-${m}-${y}`
}

export function titleCase(value: string): string {
  return value
    .split(/[_\s]+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ")
}
