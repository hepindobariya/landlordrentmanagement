import type { Response } from "express"

// Consistent JSON envelope used across all endpoints.
export interface SuccessBody<T> {
  success: true
  data: T
}

export interface ErrorBody {
  success: false
  error: {
    message: string
    details?: unknown
  }
}

export function sendOk<T>(res: Response, data: T, status = 200): Response {
  const body: SuccessBody<T> = { success: true, data }
  return res.status(status).json(body)
}

export function sendError(
  res: Response,
  message: string,
  status = 400,
  details?: unknown
): Response {
  const body: ErrorBody = { success: false, error: { message, details } }
  return res.status(status).json(body)
}
