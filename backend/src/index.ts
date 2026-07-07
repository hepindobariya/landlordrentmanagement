import cors from "cors"
import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express"
import helmet from "helmet"
import { env } from "./config/env"
import { supabase } from "./lib/supabase"
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
    // Lightweight connectivity probe. This call succeeds even before any
    // application tables exist; a network/config failure will throw.
    const { error } = await supabase.auth.getUser("health-check-probe")
    // An "invalid token" style error still proves we reached Supabase.
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

// 404 fallback
app.use((_req: Request, res: Response) => {
  return sendError(res, "Route not found", 404)
})

// Centralized error handler
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const message = err instanceof Error ? err.message : "Internal server error"
  console.error("Unhandled error:", err)
  return sendError(res, message, 500)
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
