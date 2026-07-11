// Tiny helper for calling the backend REST API with the logged-in
// user's Supabase access token attached as a Bearer token.
import { supabase } from "./supabase"

const rawApiUrl = process.env.EXPO_PUBLIC_API_URL

// Matches the backend's JSON envelope: { success, data } or { success, error }.
type ApiSuccess<T> = { success: true; data: T }
type ApiError = { success: false; error: { message: string; details?: unknown } }
type ApiResult<T> = ApiSuccess<T> | ApiError

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  if (!rawApiUrl) {
    throw new Error(
      "Missing EXPO_PUBLIC_API_URL. Create a mobile/.env file (see mobile/.env.example)."
    )
  }

  // Remove any trailing slash so `${base}/api/v1/...` never double-slashes.
  const baseUrl = rawApiUrl.replace(/\/+$/, "")

  // Grab the current session's access token.
  const {
    data: { session },
  } = await supabase.auth.getSession()

  const token = session?.access_token
  if (!token) {
    throw new Error("You are not logged in. Please log in again.")
  }

  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers ?? {}),
    },
  })

  // Global 401 handling: a rejected or expired token signs the user out so the
  // app returns to the Login screen instead of surfacing a generic error.
  if (response.status === 401) {
    await supabase.auth.signOut()
    throw new Error("Your session has expired. Please log in again.")
  }

  let body: ApiResult<T>
  try {
    body = (await response.json()) as ApiResult<T>
  } catch {
    throw new Error(`Unexpected server response (status ${response.status}).`)
  }

  if (!response.ok || !body.success) {
    const message = !body.success
      ? body.error.message
      : `Request failed with status ${response.status}.`
    throw new Error(message)
  }

  return body.data
}
