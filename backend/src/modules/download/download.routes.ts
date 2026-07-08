import { Router, type Request, type Response } from "express"
import QRCode from "qrcode"
import { supabase } from "../../lib/supabase"

export const downloadRouter = Router()

// Not a secret — safe to keep in code.
const APP_NAME = "Landlord Rent Management"

// Escape user/EAS-provided values before embedding them in HTML.
function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

// Shared mobile-friendly HTML shell with inline styles.
function pageShell(bodyInner: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(APP_NAME)} — Download</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #F9FAFB;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #111827;
      padding: 24px;
    }
    .card {
      background: #FFFFFF;
      border: 1px solid #E5E7EB;
      border-radius: 16px;
      padding: 32px 24px;
      width: 100%;
      max-width: 380px;
      text-align: center;
      box-shadow: 0 10px 30px rgba(0,0,0,0.05);
    }
    h1 { font-size: 22px; margin: 0 0 4px; }
    .muted { color: #6B7280; font-size: 15px; margin: 4px 0; }
    .small { font-size: 13px; }
    .btn {
      display: block;
      background: #2563EB;
      color: #FFFFFF;
      text-decoration: none;
      font-weight: 700;
      font-size: 17px;
      padding: 16px;
      border-radius: 12px;
      margin: 20px 0 8px;
    }
    .btn:active { background: #1D4ED8; }
    .qr {
      margin-top: 12px;
      border-radius: 12px;
      border: 1px solid #E5E7EB;
    }
  </style>
</head>
<body>
  <main class="card">
    ${bodyInner}
  </main>
</body>
</html>`
}

// GET /download — shows the latest Android build with a download button + QR.
downloadRouter.get(
  "/",
  async (_req: Request, res: Response): Promise<Response> => {
    try {
      const { data, error } = await supabase
        .from("app_releases")
        .select("*")
        .eq("platform", "android")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()

      if (error) throw new Error(error.message)

      if (!data || !data.apk_url) {
        return res
          .status(200)
          .type("html")
          .send(
            pageShell(
              `<h1>${escapeHtml(APP_NAME)}</h1>
               <p class="muted">No build available yet.</p>
               <p class="muted small">Please check back soon.</p>`
            )
          )
      }

      const apkUrl: string = String(data.apk_url)
      const qrDataUrl = await QRCode.toDataURL(apkUrl, {
        width: 240,
        margin: 1,
      })
      const safeUrl = escapeHtml(apkUrl)

      return res
        .status(200)
        .type("html")
        .send(
          pageShell(
            `<h1>${escapeHtml(APP_NAME)}</h1>
             <p class="muted">Latest Android build</p>
             <a class="btn" href="${safeUrl}">⬇ Download APK</a>
             <p class="muted small">Or scan to download on your phone</p>
             <img class="qr" src="${qrDataUrl}" alt="QR code to download the APK" width="240" height="240" />`
          )
        )
    } catch (err) {
      console.error("/download error:", err)
      return res
        .status(500)
        .type("html")
        .send(
          pageShell(
            `<h1>${escapeHtml(APP_NAME)}</h1>
             <p class="muted">Something went wrong loading the latest build.</p>
             <p class="muted small">Please try again later.</p>`
          )
        )
    }
  }
)
