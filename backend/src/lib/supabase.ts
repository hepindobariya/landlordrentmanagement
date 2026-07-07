import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { env } from "../config/env"

// Server-side client using the service role key.
// Session persistence/refresh are disabled because this runs on a stateless server.
export const supabase: SupabaseClient = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
)
