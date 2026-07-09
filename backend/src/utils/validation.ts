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
