import { z } from "zod"

// Shared Zod primitives reused across all resource modules.
export const uuidSchema = z.string().uuid({ message: "Must be a valid UUID" })

export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")

// For routes with an :id path param.
export const idParamSchema = z.object({ id: uuidSchema })

// Optional pagination shared across list endpoints. Backward compatible:
// when limit/offset are omitted, endpoints return the full (ordered) list.
export const paginationSchema = z.object({
  limit: z.coerce.number().int().positive().max(200).optional(),
  offset: z.coerce.number().int().nonnegative().optional(),
})

// PostgREST's .or() filter uses commas/parentheses as syntax, so strip any
// characters from a free-text search term that could break the filter.
export function sanitizeSearch(term: string): string {
  return term.replace(/[%,()*]/g, " ").trim()
}

// ---------------------------------------------------------------------------
// Money helpers
// ---------------------------------------------------------------------------
// Store and compare money at 2-decimal (paise) precision. Doing arithmetic on
// raw floats causes drift (e.g. 14999.999999 never flips a charge to "paid"),
// so every computed money value is passed through roundMoney.
export function roundMoney(value: number): number {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100
}

// Accepts a number, or a human-typed string like "15,000", "₹15000",
// "15,000.50" or " 15000 ". Grouping commas, the rupee symbol and surrounding
// whitespace are stripped before validation so the API no longer rejects
// perfectly valid amounts just because they contain a comma.
function cleanMoneyInput(val: unknown): unknown {
  if (typeof val === "string") {
    const cleaned = val.replace(/[₹,\s]/g, "")
    if (cleaned === "") return undefined
    const n = Number(cleaned)
    return Number.isNaN(n) ? val : n
  }
  return val
}

// Non-negative money (rent, deposit, charge amount, partial amount_paid).
export const moneySchema = z.preprocess(
  cleanMoneyInput,
  z
    .number({ invalid_type_error: "Amount must be a number" })
    .nonnegative("Amount cannot be negative")
    .transform(roundMoney)
)

// Strictly positive money (a recorded payment must be greater than zero).
export const positiveMoneySchema = z.preprocess(
  cleanMoneyInput,
  z
    .number({ invalid_type_error: "Amount must be a number" })
    .positive("Amount must be greater than zero")
    .transform(roundMoney)
)
