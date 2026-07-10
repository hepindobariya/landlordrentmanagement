import dotenv from "dotenv"
import { z } from "zod"

dotenv.config()

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  // Render injects PORT; fall back to 3000 for local dev.
  PORT: z.coerce.number().int().positive().default(3000),
  SUPABASE_URL: z.string().url({ message: "SUPABASE_URL must be a valid URL" }),
  SUPABASE_SERVICE_ROLE_KEY: z
    .string()
    .min(1, "SUPABASE_SERVICE_ROLE_KEY is required"),
  // Optional now; needed when we verify end-user access tokens in later stages.
  SUPABASE_ANON_KEY: z.string().min(1).optional(),
  // Optional so the server still boots before you set it; the webhook route
  // returns 500 if it's missing when a webhook actually arrives.
  EAS_WEBHOOK_SECRET: z.string().min(1).optional(),
  // Business timezone for all date-only values (rent due dates, paid dates,
  // "this month" reporting). Defaults to India time so an IST landlord never
  // sees off-by-one dates from UTC drift after midnight local time.
  APP_TIMEZONE: z.string().min(1).default("Asia/Kolkata"),
  // Telegram notifications (Stage 4). Optional so the server still boots before
  // they're set; notification sends are skipped/logged when missing.
  TELEGRAM_BOT_TOKEN: z.string().min(1).optional(),
  TELEGRAM_BOT_USERNAME: z.string().min(1).optional(),
  NOTIFICATIONS_CRON_SECRET: z.string().min(1).optional(),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  console.error(
    "❌ Invalid environment variables:",
    JSON.stringify(parsed.error.flatten().fieldErrors, null, 2)
  )
  process.exit(1)
}

export const env = parsed.data
export type Env = typeof env
