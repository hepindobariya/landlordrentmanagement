import type { Request } from "express"
import { supabase } from "../lib/supabase"
import { asyncHandler } from "../utils/asyncHandler"
import { ApiError } from "../utils/errors"

// Requires a valid Supabase access token in the Authorization header.
// Verifies it, sets req.landlordId, and ensures a matching landlords row
// exists (idempotent upsert) so foreign keys on child inserts never fail.
export const requireAuth = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization
  if (!header || !header.startsWith("Bearer ")) {
    throw new ApiError(401, "Missing or invalid Authorization header")
  }

  const token = header.slice("Bearer ".length).trim()
  if (!token) throw new ApiError(401, "Missing bearer token")

  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data.user) {
    throw new ApiError(401, "Invalid or expired token")
  }

  const user = data.user

  // Auto-provision the landlord profile on first authenticated request.
  // ignoreDuplicates => insert only if missing; never overwrites existing.
  const { error: upsertError } = await supabase
    .from("landlords")
    .upsert(
      { id: user.id, email: user.email ?? null },
      { onConflict: "id", ignoreDuplicates: true }
    )
  if (upsertError) throw new ApiError(500, upsertError.message)

  req.landlordId = user.id
  next()
})

// Helper to read the landlord id with a non-optional return type.
export function getLandlordId(req: Request): string {
  if (!req.landlordId) throw new ApiError(401, "Not authenticated")
  return req.landlordId
}
