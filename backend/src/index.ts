import cors from "cors"
import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express"
import helmet from "helmet"
import path from "path"
import { ZodError } from "zod"
import { env } from "./config/env"
import { supabase } from "./lib/supabase"
import { downloadRouter } from "./modules/download/download.routes"
import { internalNotificationsRouter } from "./modules/notifications/internalNotifications.routes"
import { telegramWebhookRouter } from "./modules/notifications/telegramWebhook.routes"
import { webhooksRouter } from "./modules/webhooks/webhooks.routes"
import { apiRouter } from "./routes"
import { ApiError } from "./utils/errors"
import { sendError, sendOk } from "./utils/response"

const app = express()

// Core middleware
app.use(helmet({ contentSecurityPolicy: false }))
app.use(cors())

// ---------------------------------------------------------------------------
// PUBLIC RAW routes (no Bearer auth). Mounted BEFORE express.json() because the
// EAS webhook needs the RAW request body for HMAC signature verification.
// (The /download route is a GET returning HTML, so it needs no body parsing.)
// ---------------------------------------------------------------------------
app.use("/webhooks", webhooksRouter)
app.use("/download", downloadRouter)

// Serve the static frontend (landing page and PWA)
app.use(express.static(path.join(process.cwd(), "public")))

// JSON parsing for the rest of the API.
app.use(express.json())

// ---------------------------------------------------------------------------
// PUBLIC JSON routes (no Bearer auth) that DO need a parsed JSON body.
// - /webhooks/telegram: receives Telegram bot updates (guarded by an
//   unguessable link token, not by auth). The EAS webhooksRouter above has no
//   /telegram route, so requests fall through to this handler after JSON parse.
// - /internal/notifications/run: guarded by the x-cron-secret header.
// Mounted before /api/v1 so they never hit requireAuth.
// ---------------------------------------------------------------------------
app.use("/webhooks", telegramWebhookRouter)
app.use("/internal", internalNotificationsRouter)

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

// Versioned API routes (all require a valid Supabase access token).
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
