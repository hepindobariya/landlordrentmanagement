import crypto from "crypto"
import { Router, raw, type Request, type Response } from "express"
import { env } from "../../config/env"
import { supabase } from "../../lib/supabase"

export const webhooksRouter = Router()

// Constant-time string comparison to avoid timing attacks on the signature.
function timingSafeEqualStr(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return crypto.timingSafeEqual(bufA, bufB)
}

// POST /webhooks/eas-build
// Receives EAS Build webhooks. Uses express.raw so we have the RAW body
// needed to verify the HMAC-SHA1 signature in the "expo-signature" header.
webhooksRouter.post(
  "/eas-build",
  raw({ type: "*/*" }),
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const secret = env.EAS_WEBHOOK_SECRET
      if (!secret) {
        console.error(
          "EAS webhook received but EAS_WEBHOOK_SECRET is not configured."
        )
        return res.status(500).json({
          success: false,
          error: { message: "Webhook secret not configured" },
        })
      }

      // Thanks to express.raw above, req.body is a Buffer.
      const rawBody: Buffer = Buffer.isBuffer(req.body)
        ? req.body
        : Buffer.from("")

      // EAS sends: expo-signature: sha1=<hmac hex>
      const signatureHeader = req.header("expo-signature") ?? ""
      const expected =
        "sha1=" +
        crypto.createHmac("sha1", secret).update(rawBody).digest("hex")

      if (!timingSafeEqualStr(signatureHeader, expected)) {
        console.warn("EAS webhook signature mismatch — rejecting.")
        return res
          .status(401)
          .json({ success: false, error: { message: "Invalid signature" } })
      }

      // Parse the JSON payload from the raw body.
      let payload: {
        id?: string
        status?: string
        platform?: string
        artifacts?: {
          applicationArchiveUrl?: string
          buildUrl?: string
        }
      }
      try {
        payload = JSON.parse(rawBody.toString("utf8"))
      } catch {
        console.error("EAS webhook: could not parse JSON body.")
        // Ack anyway so EAS doesn't keep retrying a malformed delivery.
        return res.status(200).json({ success: true })
      }

      const status = payload.status
      const platform = payload.platform
      const buildId = payload.id ? String(payload.id) : null
      const apkUrl =
        payload.artifacts?.applicationArchiveUrl ??
        payload.artifacts?.buildUrl ??
        null

      if (status === "finished" && platform === "android" && apkUrl) {
        const { error } = await supabase.from("app_releases").insert({
          platform: "android",
          build_id: buildId,
          apk_url: apkUrl,
        })

        if (error) {
          console.error(
            "EAS webhook: failed to insert app_release:",
            error.message
          )
        } else {
          console.log(`EAS webhook: stored new android build ${buildId}`)
        }
      } else {
        console.log(
          `EAS webhook ignored (status=${status}, platform=${platform}, hasUrl=${Boolean(
            apkUrl
          )}).`
        )
      }

      // Always ack quickly so EAS doesn't retry unnecessarily.
      return res.status(200).json({ success: true })
    } catch (err) {
      console.error("EAS webhook handler error:", err)
      // Still ack to avoid retry storms; the error is logged for us.
      return res.status(200).json({ success: true })
    }
  }
)
