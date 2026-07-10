import { Router, type Request, type Response } from "express"
import { env } from "../../config/env"
import { runTimeBasedNotifications } from "./timeBased.service"

// PUBLIC router (no Bearer auth) mounted at /internal, so the full path is
// POST /internal/notifications/run. Protected by a shared-secret header
// (x-cron-secret) so only your scheduler can trigger it.
export const internalNotificationsRouter = Router()

internalNotificationsRouter.post(
  "/notifications/run",
  async (req: Request, res: Response): Promise<Response> => {
    const secret = env.NOTIFICATIONS_CRON_SECRET
    if (!secret) {
      console.error("[internal] NOTIFICATIONS_CRON_SECRET is not configured")
      return res.status(500).json({
        success: false,
        error: { message: "Cron secret not configured" },
      })
    }

    const provided = req.header("x-cron-secret") ?? ""
    if (provided !== secret) {
      return res.status(401).json({
        success: false,
        error: { message: "Invalid cron secret" },
      })
    }

    try {
      const result = await runTimeBasedNotifications()
      return res.status(200).json({ success: true, data: result })
    } catch (e) {
      const message = e instanceof Error ? e.message : "Run failed"
      console.error("[internal] notifications run failed:", message)
      return res.status(500).json({ success: false, error: { message } })
    }
  }
)
