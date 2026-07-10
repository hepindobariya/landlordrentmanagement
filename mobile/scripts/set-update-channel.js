#!/usr/bin/env node
/**
 * set-update-channel.js
 *
 * expo-updates needs an "expo-channel-name" request header so the installed
 * app knows which EAS Update channel to pull OTA updates from. When you build
 * with `eas build`, EAS injects this automatically. Because our CI builds the
 * APK directly with Gradle (after `expo prebuild`), we must inject it ourselves.
 *
 * It writes/updates this <meta-data> entry in AndroidManifest.xml:
 *   expo.modules.updates.EXPO_UPDATES_REQUEST_HEADERS = {"expo-channel-name":"<channel>"}
 *
 * Usage: node scripts/set-update-channel.js <channel>   (defaults to "preview")
 * Run it AFTER `expo prebuild` and BEFORE the Gradle build.
 */
const fs = require("fs")
const path = require("path")

const channel = process.argv[2] || "preview"
const manifestPath = path.join(
  __dirname,
  "..",
  "android",
  "app",
  "src",
  "main",
  "AndroidManifest.xml"
)

if (!fs.existsSync(manifestPath)) {
  console.error(
    `[set-update-channel] AndroidManifest.xml not found at ${manifestPath}`
  )
  console.error("[set-update-channel] Did `expo prebuild` run first?")
  process.exit(1)
}

let manifest = fs.readFileSync(manifestPath, "utf8")

const NAME = "expo.modules.updates.EXPO_UPDATES_REQUEST_HEADERS"
const rawValue = JSON.stringify({ "expo-channel-name": channel })
// Escape double quotes for use inside an XML attribute value.
const xmlValue = rawValue.replace(/"/g, "&quot;")
const metaTag = `<meta-data android:name="${NAME}" android:value="${xmlValue}" />`

// Match any existing meta-data tag with this exact android:name.
const existing = new RegExp(
  `<meta-data\\s+android:name="${NAME.replace(/\./g, "\\.")}"[^>]*/>`
)

if (existing.test(manifest)) {
  manifest = manifest.replace(existing, metaTag)
  console.log(`[set-update-channel] Updated channel meta-data to "${channel}".`)
} else {
  const idx = manifest.lastIndexOf("</application>")
  if (idx === -1) {
    console.error(
      "[set-update-channel] Could not find </application> in AndroidManifest.xml"
    )
    process.exit(1)
  }
  manifest =
    manifest.slice(0, idx) + `    ${metaTag}\n    ` + manifest.slice(idx)
  console.log(`[set-update-channel] Inserted channel meta-data "${channel}".`)
}

fs.writeFileSync(manifestPath, manifest, "utf8")
