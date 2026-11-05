# Tuition Manager

A mobile-first web app for tutors and their students: attendance, a shared
study diary, and monthly progress. Teachers and students each have their
own accounts; an admin can see everything.

Stack: React + Vite + TypeScript + Tailwind (frontend), Node + Express +
TypeScript + MongoDB/Mongoose + JWT (backend). No microservices, no paid
services required.

## Accounts and roles

| Role | How the account is made | Can |
|---|---|---|
| **Admin** | `npm run seed` (never through the sign-up page) | See every teacher (with their key and student count), every student, diary, attendance and report |
| **Teacher** | Sign up → **Teacher** | Get a 6-character **teacher key**; see only their own students; mark attendance; write, edit and delete diary entries; share files with a student; post notices to all their students; record exam results; edit student details, class days/time and monthly targets; send a diary entry to the guardian on WhatsApp; reports |
| **Student** | Sign up → **Student**, entering their teacher's key | See their own attendance (read-only), notices, study materials, exam results and diary; write diary entries; edit entries they wrote; tick homework done |

- The teacher key is what links a student to the right teacher — a student
  can't join a teacher without it. Teachers can copy or share it from the
  home screen and issue a new one from **Account** (students already
  linked stay linked).
- Teachers can also add a student who has no phone/account from
  **Students → Add**.
- Every API route enforces these rules on the server
  (`backend/src/utils/access.ts`); the UI only hides what a role can't use.

## What's included

- **Attendance by tapping**: on a student's page a teacher taps a day to
  mark the student present, and taps a green day again to undo. Future
  days can't be marked. The dashboard has a one-tap **Mark** button per
  student for today. One record per student/date is enforced by a unique
  index in MongoDB.
- **Monthly summary** (present / target / remaining / progress) above
  each student's calendar.
- **Hide attendance from a student**: the teacher's switch above the
  calendar ("Student can see attendance") decides whether that student's
  app shows the calendar and monthly counts. **Account → Hide from all /
  Show to all** sets it for every one of the teacher's students at once.
  When hidden, the API itself refuses the student's attendance request;
  the teacher and admin still see everything.
- **Shared diary** with subject, topic, what was covered, homework, next
  class prep and notes. Students write their own entries; teachers write
  from the student's page or the Diary tab. Whenever an entry's content
  is changed, the previous version is kept: the entry shows an **Edited**
  tag (**Edited by student** when a student made the last change), and
  tapping it shows every earlier version as plain text with who changed
  it and when. Ticking homework done is not counted as an edit. Students
  can't delete entries, so edits can't be hidden.
- After marking a day present, an optional prompt offers to add that
  day's diary entry.
- **Study materials**: on a student's page the teacher uploads any file
  (photos, PDF, Word, PowerPoint, …, up to 20 MB). Only that student and
  their teacher (and the admin) can see or download it. Images and PDFs
  open in the browser; every other type downloads, so an uploaded HTML or
  SVG file can never run inside the app.
- **Notices**: a teacher posts a notice once and all of their students see
  it on their home screen (marked **NEW** until they open Notices).
- **Send diary to guardian on WhatsApp**: each diary entry has a
  **WhatsApp** button for the teacher. It opens WhatsApp on the teacher's
  own phone with the entry written out and the guardian's number filled
  in (local numbers like `01712345678` get the `880` code added); the
  teacher taps send, so it comes from their own number. This uses
  WhatsApp's free click-to-chat link — sending automatically, without the
  teacher tapping send, would need the paid WhatsApp Business API.
- **On the student page**: class days and time (set by the teacher), a
  **Homework to do** list built from diary entries that have pending
  homework (tick to finish), and **exam results** with a percentage bar
  per exam and an overall average.
- Calendar across all of a teacher's students, monthly reports (print
  friendly), exam results on the student page.
- Mobile-first UI: bottom tab bar, bottom-sheet forms, large tap targets,
  16px inputs (no iOS zoom), safe-area padding for notched phones; a
  sidebar layout on desktop.
- All class/diary dates are stored and computed as Asia/Dhaka calendar
  dates (plain YYYY-MM-DD strings), avoiding UTC day-boundary bugs.

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
npm run seed                           # creates the admin account
```

The frontend needs no `.env`: it calls same-origin `/api`, which Vite
proxies to the backend on port 5000 (see `frontend/vite.config.ts`).

### 2. Run

```bash
npm run dev     # backend on http://localhost:5000, frontend on http://localhost:5173
```

Open http://localhost:5173 and log in with the ADMIN_EMAIL / ADMIN_PASSWORD
from `backend/.env`, or use **Create an account** to sign up as a teacher,
then as a student with that teacher's key. You can also run each side on its own with
`npm run dev` inside `backend/` or `frontend/`.

### 3. Running the tests

```bash
cd backend && npm run test:all   # node:test (pure logic) + Jest/Supertest (HTTP-level, mocked DB) — 125 tests
cd frontend && npm test          # vitest — attendance math, WhatsApp number/message formatting
```

`backend`'s tests run at two levels:
- `npm test` — `node:test`, pure functions: attendance math, month-boundary
  date logic (leap years, December→January rollover).
- `npm run test:api` — Jest + Supertest, hitting the real Express app
  (real auth middleware, real Zod validation, real rate limiting, real
  CORS/Helmet headers) with only the MongoDB model calls mocked. Covers
  every route, including role access (teachers only reach their own
  students, students only themselves), sign-up with a teacher key, the
  attendance toggle, diary edit history, the monthly report's exact
  numbers, and student archive-vs-hard-delete.

The Jest tests mock MongoDB. The full flows (sign-ups, key linking,
scoping between two teachers, attendance toggle, diary edit history,
reports) were also run end-to-end against a real local MongoDB, and the
UI was checked at phone size for each role.

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
`SESSION_DAYS=90` (how long a login lasts; optional, defaults to 90), `CORS_ORIGIN` (your Vercel URL, e.g.
`https://tuition-manager.vercel.app`; comma-separate several).

`--include=dev` is required: with `NODE_ENV=production`, a plain
`npm install` skips TypeScript and the build fails.

**Create the admin account.** (Teachers and students sign up in the app;
only the admin comes from the seed script.) Render's free tier has no shell, so run the
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
- Atlas M0 gives 512 MB. Uploaded files are stored in the database
  (GridFS), so they use this space — roughly a hundred 5 MB slide decks.
  If Atlas loaded its sample data into your cluster, deleting the
  `sample_*` databases frees ~140 MB. Render's own disk is wiped on every
  deploy, which is why files aren't kept there.

## Notes on business rules implemented

- Only `status: "completed"` class sessions count toward monthly targets.
  Tapping a day creates that record; tapping again deletes it. Records
  left over from the older scheduled/cancelled flow turn into present
  when tapped.
- A student can have exactly one class record per calendar date —
  enforced by a unique index on `{student, date}` in MongoDB, not just app
  code. `POST /api/classes/toggle` never creates a duplicate.
- Creating a diary entry never touches attendance, and marking attendance
  never auto-creates a diary entry — the "add diary" prompt after marking
  present is an offer, not a side effect.
- Changing a student's `monthlyClassTarget` never rewrites past
  `ClassSession` records — historical months are computed from the
  sessions that existed in that month.
- Archiving a student (the default delete action) preserves all of
  their class/diary/exam history; only an explicit `?hard=true` delete
  removes the student document itself, and even then historical records
  are left in place.
- Before roles existed, the admin lived in an `admins` collection. On
  startup the server copies any such admin into `users` (role `admin`),
  so an existing admin login keeps working without re-seeding. Old
  sessions are signed out once and need a fresh login.
- Reminders (`/api/reminders`) have no owner yet, so they are admin-only.
