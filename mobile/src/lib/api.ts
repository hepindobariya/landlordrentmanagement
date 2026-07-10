import { Alert } from "react-native"
import { ApiError, NetworkError, SessionExpiredError } from "./errors"
import { supabase } from "./supabase"

const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? "").replace(/\/+$/, "")

type ApiEnvelope<T> =
  | { success: true; data: T }
  | { success: false; error: { message: string; details?: unknown } }

// Always read the CURRENT access token from the live session (not cached).
async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? null
}

async function doRequest(
  path: string,
  options: RequestInit,
  token: string | null
): Promise<Response> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  }
  if (token) headers.Authorization = `Bearer ${token}`

  try {
    return await fetch(`${API_URL}${path}`, { ...options, headers })
  } catch (e) {
    throw new NetworkError(e instanceof Error ? e.message : "Network request failed")
  }
}

export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  let token = await getAccessToken()
  let response = await doRequest(path, options, token)

  // On 401: refresh the session ONCE and retry.
  if (response.status === 401) {
    const { data, error } = await supabase.auth.refreshSession()
    if (!error && data.session) {
      token = data.session.access_token
      response = await doRequest(path, options, token)
    }
    if (response.status === 401) {
      // Unrecoverable: clear session -> App's auth listener returns to Login.
      await supabase.auth.signOut()
      Alert.alert("Session expired", "Your session has expired. Please log in again.")
      throw new SessionExpiredError()
    }
  }

  let body: ApiEnvelope<T> | null = null
  try {
    body = (await response.json()) as ApiEnvelope<T>
  } catch {
    body = null
  }

  if (!response.ok || !body || body.success === false) {
    const message =
      body && body.success === false
        ? body.error?.message
        : `Request failed (${response.status})`
    const details =
      body && body.success === false ? body.error?.details : undefined
    throw new ApiError(message ?? "Request failed", response.status, details)
  }

  return body.data
}
