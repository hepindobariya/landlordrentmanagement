// Typed errors + friendly-message mapping. Never surface raw errors to users.

export class ApiError extends Error {
  status: number
  details?: unknown
  constructor(message: string, status: number, details?: unknown) {
    super(message)
    this.name = "ApiError"
    this.status = status
    this.details = details
  }
}

export class NetworkError extends Error {
  constructor(message = "Network request failed") {
    super(message)
    this.name = "NetworkError"
  }
}

export class SessionExpiredError extends Error {
  constructor(message = "Session expired") {
    super(message)
    this.name = "SessionExpiredError"
  }
}

// Map any thrown error to a short, friendly sentence for the UI.
// `action` customizes the verb, e.g. getFriendlyError(e, "create property").
export function getFriendlyError(error: unknown, action?: string): string {
  // Always log the real error (not shown to the user).
  console.error("[error]", action ? `while trying to ${action}:` : "", error)

  if (error instanceof SessionExpiredError) {
    return "Your session has expired. Please log in again."
  }
  if (error instanceof NetworkError) {
    return "Network error. Check your connection and try again."
  }
  if (error instanceof ApiError) {
    if (error.status === 400) {
      return "Some details look invalid. Please check the form and try again."
    }
    if (error.status === 401 || error.status === 403) {
      return "You don't have permission to do that."
    }
    if (error.status === 404) {
      return "That item couldn't be found. It may have been deleted."
    }
    if (error.status >= 500) {
      return action
        ? `Couldn't ${action} right now. Please try again in a moment.`
        : "The server had a problem. Please try again in a moment."
    }
  }
  return action ? `Couldn't ${action}. Please try again.` : "Something went wrong. Please try again."
}
