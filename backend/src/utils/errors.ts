// A typed error that carries an HTTP status code and optional details.
// Throw this anywhere in a handler; the central error middleware in
// index.ts converts it into a consistent JSON error response.
export class ApiError extends Error {
  public readonly status: number
  public readonly details?: unknown

  constructor(status: number, message: string, details?: unknown) {
    super(message)
    this.name = "ApiError"
    this.status = status
    this.details = details
    // Restore prototype chain (needed when targeting ES5/ES6 with classes).
    Object.setPrototypeOf(this, ApiError.prototype)
  }
}
