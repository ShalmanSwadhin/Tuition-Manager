# Tuition Manager

A lightweight, private web app for a solo tutor to manage students, daily
study diaries, class attendance/calendars, and academic progress.

Stack: React + Vite + TypeScript + Tailwind (frontend), Node + Express +
TypeScript + MongoDB/Mongoose + JWT (backend). No microservices, no paid
services required.

## What's included

- JWT auth with a single admin account (no public signup)
- Students CRUD with individually configurable monthly class targets
- Per-student monthly attendance calendar: tap a date to Mark Completed /
  Schedule / Cancel / Remove, with a subtle green/blue/grey legend and a
  DB-level unique constraint — one class record per student/date, full stop
- Compact monthly summary (target/completed/remaining/progress%) above
  each student's calendar, computed by the backend
- Global calendar across all students, color-coded, with an agenda list
- Quick daily diary: a compact modal to log a lesson in seconds, openable
  from a student's profile (pre-filled) or the dashboard (pick a student);
  supports multiple entries per day, editing, deleting, and filtering by
  date/subject; expandable diary history inside each student's profile
- After marking a class completed, an optional one-tap prompt offers to
  open the diary modal prefilled to that student/date — never forced
- "Hide attendance" toggle on each student's profile: blurs the monthly
  summary and calendar (and disables taps on it) for moments when the
  student can see your screen — tap the overlay or the button again to
  reveal. There's no student login in this app at all, so this is purely
  for shared-screen moments, not app-level access control.
- Exam results with progress-at-a-glance
- Dashboard with summary cards, today's schedule, recent diary activity,
  students approaching their monthly target, and a quick-diary shortcut
- Monthly report per student + overall totals, with a print-friendly view
- All class/diary dates are stored and computed as Asia/Dhaka calendar
  dates (plain YYYY-MM-DD strings), avoiding UTC day-boundary bugs
- Backend and frontend unit tests for the attendance math and date logic

## Project structure

```
backend/   Express + TypeScript API, MongoDB via Mongoose
frontend/  React + Vite + TypeScript + Tailwind SPA
```

## Local setup

Requires Node 20+ and a MongoDB you can reach (a local `mongod` on
`127.0.0.1:27017`, or a free Atlas cluster).

### 1. One-time setup

```bash
cp backend/.env.example backend/.env   # set JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD (and MONGODB_URI if not local)
npm run install:all                    # installs root, backend and frontend deps
npm run seed                           # creates your one admin account
```

The frontend needs no `.env`: it calls same-origin `/api`, which Vite
proxies to the backend on port 5000 (see `frontend/vite.config.ts`).

### 2. Run

```bash
npm run dev     # backend on http://localhost:5000, frontend on http://localhost:5173
```

Open http://localhost:5173 and log in with the ADMIN_EMAIL / ADMIN_PASSWORD
from `backend/.env`. You can also run each side on its own with
`npm run dev` inside `backend/` or `frontend/`.

### 3. Running the tests

```bash
cd backend && npm run test:all   # node:test (pure logic) + Jest/Supertest (HTTP-level, mocked DB) — 60 tests
cd frontend && npm test          # vitest — attendance math on the UI side
```

`backend`'s tests run at two levels:
- `npm test` — `node:test`, pure functions: attendance math, month-boundary
  date logic (leap years, December→January rollover).
- `npm run test:api` — Jest + Supertest, hitting the real Express app
  (real auth middleware, real Zod validation, real rate limiting, real
  CORS/Helmet headers) with only the MongoDB model calls mocked. Covers
  every route, including the attendance calendar's upsert-not-duplicate
  rule, the monthly report's exact numbers against the spec's acceptance
  scenarios, and student archive-vs-hard-delete.

**What these tests don't cover:** a real MongoDB instance. This sandbox
can't reach `fastdl.mongodb.org` to run an in-memory Mongo for true
end-to-end tests, so the database-level unique index (one class record per
student/date) has only been exercised by simulating its duplicate-key
error, not by an actual duplicate insert. Nobody has clicked through the
UI in a browser, and the full login → mark attendance → see it reflected
flow has never run against a live database. Running `npm run seed` and
`npm run dev` against a real (even local) MongoDB, then walking through
the acceptance-testing scenarios from the original spec by hand, is the
one step I couldn't do for you here.

**One real bug found and fixed during this testing:** Express 4 doesn't
forward a failed async database call to the error handler by itself — a
DB hiccup inside any route would make that request hang forever instead
of returning an error. Fixed by adding `express-async-errors` (imported
at the top of `app.ts`); a dedicated test (`app.spec.ts`) asserts a
simulated DB failure now returns a clean 500 instead of hanging. This
matters in particular for Render's free tier, where cold starts and
connection blips are common.

## Deploying for free

Push the repo to GitHub first. Then:

### 1. Database — MongoDB Atlas (free M0)

Create a cluster and a database user. Under Network Access, allow
`0.0.0.0/0`: Render's free tier has no static outbound IPs. Copy the
connection string, adding the database name, e.g.
`mongodb+srv://user:pass@cluster0.xxxx.mongodb.net/tuition-manager`.

### 2. Backend — Render (free Web Service)

Either **New → Blueprint** and pick the repo (it reads `render.yaml`), or
**New → Web Service** with:

| Setting | Value |
|---|---|
| Root Directory | `backend` |
| Build Command | `npm ci --include=dev && npm run build` |
| Start Command | `npm start` |
| Health Check Path | `/api/health` |

Environment variables: `NODE_ENV=production`, `MONGODB_URI` (Atlas),
`JWT_SECRET` (a long random string; the Blueprint generates one),
`JWT_EXPIRES_IN=7d`, `CORS_ORIGIN` (your Vercel URL, e.g.
`https://tuition-manager.vercel.app`; comma-separate several).

`--include=dev` is required: with `NODE_ENV=production`, a plain
`npm install` skips TypeScript and the build fails.

**Create the admin account.** Render's free tier has no shell, so run the
seed script from your own machine against Atlas, once:

```powershell
# PowerShell
$env:MONGODB_URI="<atlas uri>"; $env:ADMIN_EMAIL="you@example.com"; $env:ADMIN_PASSWORD="<strong password>"; npm run seed
```

```bash
# bash
MONGODB_URI="<atlas uri>" ADMIN_EMAIL="you@example.com" ADMIN_PASSWORD="<strong password>" npm run seed
```

Real environment variables take precedence over `backend/.env`.

### 3. Frontend — Vercel (Hobby)

1. In `frontend/vercel.json`, replace `YOUR-RENDER-SERVICE.onrender.com`
   with your Render hostname, then commit and push.
2. **Add New → Project**, import the repo, set **Root Directory** to
   `frontend`. Vercel detects Vite (build `npm run build`, output `dist`).
3. Leave `VITE_API_URL` **unset**.

`vercel.json` proxies `/api/*` to Render and sends every other path to
`index.html`, so deep links like `/students/123` survive a refresh.
Because the browser only ever talks to the Vercel domain, the httpOnly
login cookie is first-party. Calling `onrender.com` directly from
`vercel.app` would make it a third-party cookie, which Safari (and any
browser blocking third-party cookies) silently drops, so logins wouldn't
stick.

### Free-tier caveats

- Free Render services sleep after ~15 minutes idle; the first request
  afterwards can take ~30–60s while it wakes. The UI shows "Loading…"
  meanwhile; reload if a request times out.
- Atlas M0 gives 512 MB, plenty for this app.

## Notes on business rules implemented

- Only `status: "completed"` class sessions count toward monthly targets;
  scheduled and cancelled never do.
- A student can have exactly one class record per calendar date, full
  stop — enforced by a (non-partial) unique index on `{student, date}` in
  MongoDB, not just app code. The calendar's Mark Completed / Schedule /
  Cancel actions all go through `POST /api/classes/mark`, which upserts
  that one record rather than ever creating a duplicate.
- Creating a diary entry never touches attendance, and marking attendance
  never auto-creates a diary entry — the "add a diary entry?" prompt after
  completing a class is an offer, not a side effect.
- Changing a student's `monthlyClassTarget` never rewrites past
  `ClassSession` records — historical months are computed from the
  sessions that existed in that month, independent of the student's
  current target value.
- Archiving a student (the default delete action) preserves all of
  their class/diary/exam history; only an explicit `?hard=true` delete
  removes the student document itself, and even then historical records
  are left in place.

## What's a starting point vs. done

This is a complete, working scaffold covering every feature in the spec,
but as a solo-tutor tool you'll likely want to adjust details to taste —
e.g. richer calendar views (week/agenda toggle), PDF export for reports,
photo upload storage, and exam performance charts are stubbed at a basic
level and worth iterating on. For that kind of ongoing, multi-step build
work, Claude Code is a better fit than chat.
