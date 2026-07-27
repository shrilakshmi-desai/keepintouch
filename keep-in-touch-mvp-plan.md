# Keep-In-Touch App — MVP Architecture & Build Sequence

A working spec and step-by-step build plan for building the app with Claude Code.
**Scope:** Personal relationships only (professional/networking section deferred to v2).
**First platform:** iOS (Android comes free from the same codebase; test it after).
**How you'll run it:** Personally, inside the free **Expo Go** app on your iPhone. No App Store, no Apple Developer account needed to start. A standalone build is optional and comes much later (Step 9).

---

## 1. What we're building (MVP)

A mobile app where you:

- Sign in with Google or Apple.
- Add people (typed in, or imported from your phone contacts).
- Tag each person (relative / friend / acquaintance).
- Set a keep-in-touch schedule per person: recurring (e.g. every Sunday morning, every 6 months on a Saturday evening), a simple interval (every 2 weeks), or a one-time reminder.
- Optionally attach talking points to a person.
- Get a phone notification when it's time, with the talking points shown so you know what to bring up.
- Mark "reached out" — which reschedules the next reminder automatically.

That's the whole loop. Everything else is v2.

---

## 2. The stack (and why)

| Layer | Choice | Why |
|---|---|---|
| Mobile app | **Expo (React Native)** | One codebase → iOS + Android. Best-in-class APIs for the two things this app lives on: notifications and contacts. |
| Running it personally | **Expo Go** | Free app on your phone that runs your project live while you build. No App Store, no developer account. This is your home for the app during personal use. |
| Reminders | **Expo Notifications (on-device local)** | The MVP schedules reminders directly on the phone. No server cron, works offline, free, reliable. This is what dissolves the "reliable scheduled notifications" crux. |
| Contact import | **Expo Contacts** | Reads the phone address book with permission → tap-to-add instead of typing. This is the "low-friction entry" win, and the main reason to go native over web. |
| Backend + DB + Auth | **Supabase** | Postgres database, built-in auth with Google + Apple sign-in, and a clean Expo SDK — all in one. Simpler than wiring Vercel + a separate auth provider for an MVP. |
| Language | **TypeScript** | Type safety catches a whole class of bugs; Claude Code works well in it. |

**Note on Vercel:** not used in the MVP. Supabase covers the backend. Vercel becomes useful later if you add a web dashboard, marketing site, or server-driven push (v2+).

**Why local notifications, not server push, for v1:** your reminders are user-defined schedules ("every Sunday 9am"). The phone can fire those itself. Server push only becomes necessary when you need cross-device sync or a server to decide *when* something fires — neither is needed for the MVP. One caveat handled in the build: iOS keeps at most 64 pending scheduled notifications, so the app reschedules the next occurrence each time one fires rather than pre-scheduling forever.

**One Expo Go caveat to know:** local notifications and contacts work in Expo Go for testing. If you ever find a notification behaves differently in Expo Go than expected, that's a known quirk of the shared Expo Go container — it resolves once you make a standalone build (Step 9). For personal daily use, Expo Go is fine to start.

---

## 3. Data model (Supabase / Postgres)

Two tables to start.

**`profiles`** (one row per signed-in user — created automatically on sign-in)
- `id` (uuid, = auth user id)
- `email`
- `created_at`

**`contacts`**
- `id` (uuid)
- `user_id` (uuid → profiles.id)
- `name`
- `type` (enum: `relative` | `friend` | `acquaintance`)
- `phone` / `email` (optional)
- `talking_points` (text, optional)
- `schedule_kind` (enum: `recurring` | `interval` | `one_time`)
- `schedule_config` (jsonb — e.g. `{ "weekday": 0, "hour": 9, "minute": 0 }` for "every Sunday 9am", or `{ "everyDays": 14 }`, or `{ "fireAt": "2026-08-01T18:00:00" }`)
- `next_reminder_at` (timestamp — computed, drives the notification)
- `last_contacted_at` (timestamp, nullable)
- `created_at`

**Security:** turn on Row Level Security so each user can only read/write their own contacts. (Claude Code will set this up — it's a standard Supabase policy.)

---

## 4. Screens (MVP)

1. **Sign in** — Google / Apple buttons.
2. **People list** — everyone you track, sorted by who's due soonest; a badge on anyone overdue.
3. **Add / edit person** — name, type, optional phone/email, contact-picker button to import, schedule picker, talking points.
4. **Person detail** — their info, talking points, next reminder, and a "Reached out" button.
5. **Settings** — notification permission status, sign out.

The notification itself isn't a screen — it fires from the OS and, when tapped, opens that person's detail.

---

## 5. Step-by-step build sequence for Claude Code

Give Claude Code these as ordered milestones. Each is a natural stopping point where you can run the app in Expo Go and see progress. Copy a step's prompt, let it build, test, then move on.

### Step 0 — Prerequisites (you do this once)
- Install Node.js (LTS) and the free **Expo Go** app on your iPhone.
- Create a free Supabase account and a new project.
- **No Apple Developer account needed to start.** For personal use you run the app inside Expo Go, which is free. An Apple Developer account ($99/yr) is only required later *if* you decide you want the app as its own standalone icon (see Step 9). Google sign-in setup is free.

**Prompt to Claude Code:** "Walk me through installing Node, the Expo CLI, and setting up my Supabase project keys, one step at a time."

### Step 1 — Scaffold the app
Create a new Expo (TypeScript) project with navigation and the five screens as empty placeholders.
**Prompt:** "Create a new Expo TypeScript app called KeepInTouch with React Navigation and five placeholder screens: SignIn, PeopleList, AddEditPerson, PersonDetail, Settings. Make it run in Expo Go on my iPhone via the QR code."

### Step 2 — Supabase + auth
Wire up Supabase, create the `profiles` and `contacts` tables with RLS, and implement Google + Apple sign-in.
**Prompt:** "Connect this app to my Supabase project. Create the profiles and contacts tables with row-level security from the data model in my plan. Implement Google and Apple sign-in on the SignIn screen, and auto-create a profile row on first sign-in."

### Step 3 — Contacts CRUD
Build add/edit/list/detail for people, storing to Supabase. No scheduling logic yet — just a plain date field for `next_reminder_at`.
**Prompt:** "Implement full create/read/update/delete for contacts using the contacts table. Build the People list (sorted by next_reminder_at, overdue badge), Add/Edit form, and Person detail screen."

### Step 4 — Contact import
Add the Expo Contacts picker to the Add screen so a person can be imported with one tap.
**Prompt:** "Add an 'Import from contacts' button to the Add Person screen using Expo Contacts, requesting permission gracefully and pre-filling name/phone/email."

### Step 5 — Scheduling engine
Implement the three schedule kinds and a function that computes `next_reminder_at` from `schedule_config`.
**Prompt:** "Implement a scheduling module that, given a schedule_kind and schedule_config, computes the next reminder time. Support recurring (weekday + time), interval (every N days), and one-time. Add a schedule picker UI to the Add/Edit form."

### Step 6 — Local notifications
Schedule an Expo local notification per contact for `next_reminder_at`, include the talking points in the body, and open the person's detail when tapped. Reschedule-on-fire to respect the iOS 64-notification cap.
**Prompt:** "Using Expo Notifications, schedule a local notification for each contact at next_reminder_at with their name and talking points. When a notification is tapped, open that Person's detail. When one fires, recompute and schedule the next occurrence. Handle permission requests gracefully."

### Step 7 — "Reached out" loop
The button on Person detail sets `last_contacted_at = now`, recomputes `next_reminder_at`, and reschedules the notification.
**Prompt:** "Wire the 'Reached out' button to update last_contacted_at, recompute next_reminder_at from the schedule, and reschedule the notification."

### Step 8 — Polish + live with it in Expo Go
Empty states, loading states, permission-denied fallback, and a real end-to-end test with a reminder set a few minutes out. **This is where you start using it personally — no App Store involved.**
**Prompt:** "Add empty/loading states and a graceful fallback when notifications are denied. Then help me test end-to-end in Expo Go on my iPhone with a reminder 2 minutes from now."

### Step 9 — OPTIONAL, LATER: standalone build
Only do this if you want the app as its own icon that runs without your computer, or you decide to share it. Uses Expo EAS and requires the $99/yr Apple Developer account. For personal use, you can skip this indefinitely and stay in Expo Go.
**Prompt (when/if you want it):** "Set up EAS Build and walk me through creating a standalone iOS build I can install on my own phone via TestFlight."

---

## 6. What's deliberately NOT in the MVP

- The professional / networking section (calls, chat follow-ups, wishlist) → **v2**.
- Server-driven push and cross-device sync → **v2** (add Vercel Cron or Upstash QStash + Expo Push then).
- Rich contact enrichment / AI features → later.
- Web dashboard → later (this is where Vercel + v0 could actually earn a place).
- Standalone App Store build → optional, only if you outgrow Expo Go (Step 9).

Keeping v1 this tight is the point: it's the smallest thing that proves the core loop is useful — to you first.

---

## 7. Rough sequencing expectation

Steps 1–4 get you a working, signed-in contact book on your phone (in Expo Go). Steps 5–7 add the actual reminder magic. Step 8 is where you start living with it day to day — entirely inside Expo Go, free, no App Store. Only reach for Step 9 if and when you want it as a permanent standalone app or want to share it with others.
