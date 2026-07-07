import { supabase } from "../lib/supabase"
import { ApiError } from "./errors"

// Verifies that a row in `table` with the given id belongs to the landlord.
// Throws 404 if it doesn't exist or isn't owned by this landlord.
// Used when a child record references a parent (e.g. a unit's property_id).
export async function assertOwned(
  table: string,
  id: string,
  landlordId: string,
  label: string
): Promise<void> {
  const { data, error } = await supabase
    .from(table)
    .select("id")
    .eq("id", id)
    .eq("landlord_id", landlordId)
    .maybeSingle()

  if (error) throw new ApiError(500, error.message)
  if (!data) throw new ApiError(404, `${label} not found`)
}
