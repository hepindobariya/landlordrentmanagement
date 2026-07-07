import { z } from "zod"

// Shared Zod primitives reused across all resource modules.
export const uuidSchema = z.string().uuid({ message: "Must be a valid UUID" })

export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")

// For routes with an :id path param.
export const idParamSchema = z.object({ id: uuidSchema })
