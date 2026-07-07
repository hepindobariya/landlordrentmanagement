import type { NextFunction, Request, RequestHandler, Response } from "express"

// Wraps an async route handler so any thrown/rejected error is forwarded
// to Express's error-handling middleware via next(err).
export const asyncHandler =
  (
    fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
  ): RequestHandler =>
  (req, res, next): void => {
    fn(req, res, next).catch(next)
  }
