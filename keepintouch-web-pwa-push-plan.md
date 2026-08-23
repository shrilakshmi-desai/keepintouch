# KeepInTouch — Web + PWA + Push Build Sequence (for the portfolio)

Turn your working mobile app into a **shareable web link** with **installable PWA** and
**real push notifications** — all on free tiers. Hand these steps to Claude Code one at a
time, testing after each.

**Goal:** a URL you can put in your portfolio where friends/visitors sign in with Google,
add people, and actually get reminder notifications day to day.

---

## Architecture (and why it's free)

- **Frontend:** your existing Expo codebase, exported to **web** (React Native for Web), deployed on **Vercel** (free).
- **Backend / data / auth:** **Supabase** (free) — unchanged from what you built.
- **Scheduler + push sender:** **Supabase pg_cron + an Edge Function** (free). *Not* Vercel Cron — Vercel's free cron only runs once a day, too coarse for reminders. Supabase pg_cron runs every minute.
- **Push delivery:** **Web Push + VAPID** — no per-message cost, no third-party service.

**Cost at your scale: $0/month.** A nice side effect: the pg_cron job running every minute
keeps the Supabase project active, so it won't hit the 7-day auto-pause.

**Known web-push caveats to accept:** iPhone users must "Add to Home Screen" to get push
(iOS only allows push for installed PWAs); EU iPhones get no web push at all (Apple's rule);
delivery is a touch less instant than native. Android and desktop work smoothly.

---

## Build sequence

### Step 0 — Prereqs (you, once)
- Create a free **Vercel** account (sign in with GitHub — your project's already in git).
- Make sure your repo is pushed to GitHub (you did this).

**Prompt:** "Confirm my Expo project is ready to add a web target. List anything in the current code (libraries, native-only APIs) that won't run on web, before we start."

### Step 1 — Run the app on web
Get the existing app rendering in a browser locally and fix anything that doesn't.
**Prompt:** "Enable the Expo web target and get the app running locally in the browser with `npx expo start --web`. Fix any components or navigation that don't render on web. Don't touch notifications or contacts yet — just get sign-in and the People/Add/Detail screens working in the browser."

### Step 2 — Degrade mobile-only features gracefully on web
Contacts import and on-device local notifications don't exist on web — branch by platform.
**Prompt:** "On web, the Expo Contacts import and the on-device local-notification scheduling won't work. Please branch by platform: hide the 'Import from contacts' button on web, and replace the local-notification path on web with a placeholder we'll wire to web push in a later step. Where a mobile-only feature is hidden, show a short note like 'Contact import is available in the mobile app.' Keep the mobile behavior exactly as-is."

### Step 3 — Deploy to Vercel + open up sign-in (first shareable link!)
Ship the web app live, even before push — this alone is portfolio-ready.
**Prompt:** "Set up this Expo app to build for web and deploy on Vercel. Walk me through connecting my GitHub repo to Vercel and configuring the build so `expo export --platform web` output is served. After it's live, tell me the exact Supabase and Google settings to update: the new Vercel URL in Supabase Authentication → URL Configuration (Site URL + redirect), and I'll publish the Google consent screen to Production so anyone can sign in."

*You do in the browser:* add the Vercel URL to Supabase redirect/Site URL, and publish the
Google OAuth consent screen (APIs & Services → OAuth consent screen → Publish app). Free.

**Checkpoint:** at the end of Step 3 you have a working link — sign in, add people, see the
list — that you can already put in your portfolio. Push comes next.

### Step 4 — Make it an installable PWA
Add the manifest, icons, and service worker so it can be "Added to Home Screen" (required for iOS push).
**Prompt:** "Turn the web app into an installable PWA: add a web manifest with name/icons/theme, register a service worker, and make sure it passes the installability check (Add to Home Screen works on Android and iOS Safari). Add app icons from a simple placeholder if none exist."

### Step 5 — Web push: permissions, subscriptions, service worker
Wire the client side of push.
**Prompt:** "Implement Web Push on the web app. Generate VAPID keys and store them in Supabase secrets (I'll paste the public key into the client env). Create a `push_subscriptions` table in Supabase (user_id, subscription JSON, created_at) with RLS so users only see their own. On web, add a 'Turn on reminders' flow that requests notification permission, subscribes via the service worker, and saves the subscription to that table. In the service worker, handle the `push` event to show a notification with the title and body from the payload, and open the person's detail when tapped."

### Step 6 — The scheduler + push sender (Supabase, free)
The server side that actually fires reminders on time.
**Prompt:** "Create the reminder-sending backend on Supabase. Write an Edge Function that: queries contacts whose next_reminder_at <= now() and haven't been notified for that occurrence; for each, looks up the owner's push_subscriptions; sends a Web Push (using a Deno web-push library with my VAPID keys) with title 'Time to reach out to <name>' and the talking points as the body; then advances next_reminder_at per the schedule (or marks it done). Schedule this Edge Function to run every minute with pg_cron. Add debug logging I can view in the Supabase function logs."

### Step 7 — End-to-end test
**Prompt:** "Help me test push end to end: on my phone, install the PWA to the home screen, turn on reminders, add a person with talking points and a reminder ~2 minutes out, then lock the phone. Confirm the notification arrives with the talking points and that tapping it opens that person. Tell me which log to check (service worker vs Supabase function) if it doesn't arrive."

### Step 8 — Portfolio polish (optional but recommended)
**Prompt:** "For a portfolio demo: add a few seeded sample people so the app isn't empty on first sign-in, add empty/loading states, and show a one-line note on iPhone that reminders require 'Add to Home Screen'. Optionally add a 'Try as guest' mode with sample data so visitors can look around without signing in."

---

## What you can defer
If you want to ship the portfolio link sooner, **Steps 1–3 alone give you a live, sign-in-able
web app** — a legitimate portfolio piece. Add PWA + push (Steps 4–7) right after. Step 8 is
polish you can layer in anytime.

## Browser steps only you can do (Claude Code can't click these)
- Vercel: connect repo, deploy (Step 3).
- Supabase dashboard: add Vercel URL to redirect/Site URL; store VAPID secret (Steps 3, 5).
- Google Cloud: publish the OAuth consent screen to Production (Step 3).

## Cost recap
Vercel free + Supabase free + Web Push free = **$0/month** at friend/portfolio scale. Money
only appears at real traction (Supabase Pro $25/mo, Vercel Pro $20/mo) — a good problem to have.
