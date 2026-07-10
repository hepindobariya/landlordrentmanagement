import { Router, type Request, type Response } from "express"
import { supabase } from "../../lib/supabase"
import { sendTelegramMessage } from "../../lib/telegram"

// PUBLIC router (no Bearer auth). Mounted at /webhooks, so the full path is
// POST /webhooks/telegram. Telegram POSTs bot updates here as JSON.
export const telegramWebhookRouter = Router()

// Extract "<token>" from a "/start <token>" command (Telegram deep link start).
function parseStartToken(text: string | undefined): string | null {
  if (!text) return null
  const trimmed = text.trim()
  if (!trimmed.startsWith("/start")) return null
  const parts = trimmed.split(/\s+/)
  return parts.length >= 2 && parts[1] ? parts[1] : null
}

telegramWebhookRouter.post(
  "/telegram",
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const update = (req.body ?? {}) as {
        message?: {
          text?: string
          chat?: { id?: number | string }
        }
      }

      const message = update.message
      const chatId = message?.chat?.id
      const token = parseStartToken(message?.text)

      if (token && chatId != null) {
        const { data: settings, error } = await supabase
          .from("notification_settings")
          .select("landlord_id")
          .eq("telegram_link_token", token)
          .maybeSingle()

        if (error) {
          console.error("[telegram-webhook] lookup error:", error.message)
        } else if (settings) {
          const { error: updErr } = await supabase
            .from("notification_settings")
            .update({
              telegram_chat_id: String(chatId),
              telegram_linked: true,
              telegram_link_token: null,
              updated_at: new Date().toISOString(),
            })
            .eq("landlord_id", settings.landlord_id)

          if (updErr) {
            console.error("[telegram-webhook] bind error:", updErr.message)
            await sendTelegramMessage(
              chatId,
              "⚠️ Couldn't connect right now. Please try again from the app."
            )
          } else {
            await sendTelegramMessage(
              chatId,
              "✅ <b>Connected</b>\nYou'll now receive alerts from Landlord Rent Management here."
            )
          }
        } else {
          await sendTelegramMessage(
            chatId,
            "⚠️ That link has expired. Please tap “Connect Telegram” in the app again."
          )
        }
      }

      // Always ack 200 quickly so Telegram doesn't retry.
      return res.status(200).json({ ok: true })
    } catch (err) {
      console.error("[telegram-webhook] handler error:", err)
      return res.status(200).json({ ok: true })
    }
  }
)
