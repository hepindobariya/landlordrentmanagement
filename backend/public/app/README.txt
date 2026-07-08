RentFlow — Installable App (PWA)
================================

What this is
------------
A fully installable Progressive Web App version of the RentFlow landlord
rent-management prototype. It installs to a phone/desktop home screen, opens
full-screen (no browser bars), and works offline.

Files
-----
  index.html               The app
  manifest.webmanifest     App metadata (name, icons, colors)
  sw.js                    Service worker (offline caching)
  icons/                   App icons (192, 512, maskable, apple-touch 180)

How to run / install
--------------------
A PWA must be served over http(s) (not opened as a file://) for install +
offline to work.

1. Quick local test:
     cd rentflow-app
     python3 -m http.server 8080
   Then open http://localhost:8080 on your computer.

2. Install on a phone:
   - Host the folder anywhere with HTTPS (GitHub Pages, Netlify, Vercel,
     Cloudflare Pages, or your existing Render service under a /app route).
   - Open the URL on the phone.
   - Android/Chrome: an "Install" banner appears, or menu → Add to Home screen.
   - iOS/Safari: Share → Add to Home Screen.

Note
----
This is a front-end prototype with sample data. To make it a real product,
wire the screens to your live backend
(https://landlordrentmanagement.onrender.com/api/v1) using the Supabase auth
token, exactly like the Expo app does.
