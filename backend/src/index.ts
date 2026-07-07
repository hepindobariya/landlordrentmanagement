import cors from "cors"
import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express"
import helmet from "helmet"
import { ZodError } from "zod"
import { env } from "./config/env"
import { supabase } from "./lib/supabase"
import { apiRouter } from "./routes"
import { ApiError } from "./utils/errors"
import { sendError, sendOk } from "./utils/response"

const app = express()

// Core middleware
app.use(helmet())
app.use(cors())
app.use(express.json())

// Health check — verifies the server is up and Supabase is reachable.
app.get("/health", async (_req: Request, res: Response) => {
  let supabaseReachable = false
  try {
    const { error } = await supabase.auth.getUser("health-check-probe")
    supabaseReachable = error === null || typeof error.message === "string"
  } catch {
    supabaseReachable = false
  }

  return sendOk(res, {
    status: "ok",
    service: "landlord-rent-backend",
    env: env.NODE_ENV,
    supabase: supabaseReachable ? "reachable" : "unreachable",
    timestamp: new Date().toISOString(),
  })
})

// Versioned API routes
app.use("/api/v1", apiRouter)

// 404 fallback
app.use((_req: Request, res: Response) => {
  return sendError(res, "Route not found", 404)
})

// Centralized error handler
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof ZodError) {
    return sendError(res, "Validation failed", 400, err.flatten())
  }
  if (err instanceof ApiError) {
    return sendError(res, err.message, err.status, err.details)
  }
  console.error("Unhandled error:", err)
  return sendError(res, "Internal server error", 500)
})

// Render requires listening on process.env.PORT (validated in config/env.ts).
const server = app.listen(env.PORT, () => {
  console.log(`🚀 Server listening on port ${env.PORT} (${env.NODE_ENV})`)
})

// Graceful shutdown
const shutdown = (signal: string): void => {
  console.log(`${signal} received, shutting down...`)
  server.close(() => {
    console.log("Server closed.")
    process.exit(0)
  })
}

process.on("SIGTERM", () => shutdown("SIGTERM"))
process.on("SIGINT", () => shutdown("SIGINT"))
