import { env } from "../config/env"

export async function sendTelegramMessage(
  chatId: string | number,
  text: string
): Promise<{ ok: boolean; error?: string }> {
  const token = env.TELEGRAM_BOT_TOKEN
  if (!token) {
    console.error("[telegram] Missing TELEGRAM_BOT_TOKEN")
    return { ok: false, error: "TELEGRAM_BOT_TOKEN not configured" }
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: String(chatId),
        text,
        parse_mode: "HTML",
      }),
    })

    const body = (await res.json()) as { ok: boolean; description?: string }
    if (!res.ok || !body.ok) {
      return { ok: false, error: body.description ?? `HTTP error ${res.status}` }
    }
    return { ok: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Request failed"
    return { ok: false, error: msg }
  }
}
