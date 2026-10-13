# Shanaya OS

An AI-assisted, context-aware **Personal Operating System**: an external memory and command
center for everyday life. It captures information naturally (text, paste, camera), converts it
into structured records with Google Gemini, and only ever mutates data **after you confirm**.

> AI proposes, user disposes. Provenance is sacred. Server owns secrets. RLS everywhere.
> Timezones are first-class. Prayer times are user-provided — never calculated.
> UNKNOWN is a valid context. Confidence is visible.

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router), TypeScript strict, Tailwind CSS, shadcn-style UI, Phosphor icons, Motion |
| State | Zustand (context cache, capture store) |
| Forms | React Hook Form patterns + Zod |
| Backend | Supabase (Auth, PostgreSQL, RLS, Storage, Edge Functions, pgvector) |
| AI | Google Gemini — **server-side only**, exclusively inside Supabase Edge Functions |
| Deploy | Vercel (app) + Supabase (data/functions) |
| Tests | Vitest (unit + mocked integration), Playwright (e2e) |

## Quick start

```bash
npm install
cp .env.example .env.local        # fill in Supabase values
npm run dev                       # http://localhost:3000
```

Supabase local stack:

```bash
supabase start
supabase db push                  # applies supabase/migrations/0001…0006
supabase functions deploy process-capture ai-assistant create-event \
  generate-embedding sync-prayer-schedule daily-review
supabase secrets set GEMINI_API_KEY=... SUPABASE_SERVICE_ROLE_KEY=...
```

### Local troubleshooting

`.env.local` is git-ignored. If the app builds but the dev server never becomes usable, the most
common cause is a missing Supabase value in `.env.local`.

| Variable | Needed for | Typical symptom if missing |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | browser Supabase client | app can’t contact your project |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | browser Supabase client | auth/sign-in fails |
| `SUPABASE_SERVICE_ROLE_KEY` | server-side Supabase access | server actions/routes fail |
| `GEMINI_API_KEY` | Edge Functions only | capture/assistant calls fail only where AI is invoked |

If you do not have Supabase running yet, the app will usually still build and start, but signed-in
pages will not work until `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
are present.

### Local start helper

```bash
npm run start:local
```

That script prints the exact sequence you should follow for a fresh checkout, then starts the dev
server. It is intentionally not a one-shot "make everything work" command — Supabase and Gemini
are external services and cannot be bootstrapped by npm alone.

### Production standalone export

```bash
npm run build
npm run start:prod
```

The app is configured for `output: 'standalone'`. After `npm run build`, a self-contained Node
server lives in `standalone/`. That folder is what you would move to a host. The app still needs
runtime environment variables at runtime; it is not a static export.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run typecheck` | `tsc --noEmit` (strict) |
| `npm run lint` | Next ESLint |
| `npm test` | Vitest unit + integration tests |
| `npm run test:e2e` | Playwright e2e (needs Supabase + test user) |
| `node scripts/generate-icons.mjs` | Regenerate PWA icons |
| `node scripts/generate-fixtures.mjs` | Regenerate the e2e poster fixture |

## Repository map

```
app/                  Routes: (auth) login/signup/callback, (app) shell pages, offline
components/
  assistant/          Chat UI with editable proposal preview cards
  branding/ career/ eating/ entertainment/ family/ karate/ memory/ …
  calendar/           MonthView, WeekView, EventForm, ConflictDialog
  capture/            CaptureSheet, CapturePreview, ConfidenceBadge, ConfirmDialog, InboxView
  dashboard/          Adaptive layouts (context-driven), PrayerWidget, TodayTasks, …
  layout/             AppShell, TopBar (context chip), BottomNav
  prayer/             ScheduleImporter (CSV + diff preview)
  ui/                 shadcn-style primitives (Button, Dialog, Select, Field, …)
lib/
  actions/            Server actions — all re-validate with Zod + write audit rows
  ai/                 Tool registry, validated executor, rate limiting
  calendar/           conflicts.ts (overlap detection), recurrence.ts (client RRULE)
  context/            engine.ts (pure rules), signals.ts (geofence math), states.ts
  gemini/             Node fetch client, prompts, Zod schemas
  offline/            IndexedDB capture queue + online-flush hook
  prayer/             lookup.ts, validation.ts (365/366-day validation)
  stores/             Zustand stores
  supabase/           browser/server clients, middleware, Database types
  validation/         task, event, career, capture schemas
supabase/
  migrations/         0001_init … 0006_branding_family
  functions/          process-capture, ai-assistant, create-event,
                      generate-embedding, sync-prayer-schedule, daily-review, _shared
tests/                unit/, integration/, e2e/, fixtures/
public/               manifest.json, sw.js, icons/
```

## How the core loops work

### Universal Capture
1. Type, paste (auto-detects image), or photograph → `captures` row (`pending`).
2. `/process-capture` Edge Function calls Gemini with a structured schema (Vision for images),
   validates with Zod, computes per-field confidence, stores `ai_result` + `confidence`,
   flips status to `awaiting_confirmation`, writes an `ai_runs` row (30 calls/user/hour).
3. `CapturePreview` renders an editable proposal: confidence badges, amber (<75%) warnings.
4. Confirm → server action re-validates → for events runs conflict detection → creates the
   entity → links `source_id` → audit log. Raw capture is **never** deleted.

### Conflicts
`detectConflicts` runs before every event insert/update. On overlap the UI shows
**Keep both / Edit new / Cancel** — nothing is ever moved or deleted silently.

### Context Engine
Pure function over {time, today's events, optional geofence}. Rules: ongoing event +
geofence ≥0.9; ongoing event alone 0.6 labeled *scheduled*; geofence-only 0.85; sleep window
0.5; otherwise **UNKNOWN** ("I don't have enough context right now"). Refreshed every 60s,
cached in Zustand. Location is off by default, coordinates are compared in-memory only, and
only the context name is kept.

### Assistant
`/ai-assistant` returns either a reply or a **proposal** (tool + args). Read-only tools run
in the server action; mutating tools render an editable preview card — `Confirm` calls a
server action that re-checks Zod, runs conflict detection, executes, and audits with
`source='ai'`. There is no delete tool; the AI cannot remove data.

### Prayer
Only imported rows. CSV → validation (365/366 rows, `HH:MM`, dates inside `schedule_year`,
completeness, ordering warnings) → diff preview → replace → daily map. The database enforces
`extract(year from date) = schedule_year`.

## Security checklist (spec §16)

- [x] RLS enabled on **every** table (`0002_rls.sql`, `0006` re-applies)
- [x] `GEMINI_API_KEY` + `SERVICE_ROLE_KEY` only in Edge Function secrets
- [x] Storage bucket policies scoped to `(storage.foldername(name))[1] = auth.uid()`
- [x] Edge Functions derive `user_id` from the Bearer JWT — never from the body
- [x] Every AI-generated mutation writes `audit_logs` with `source='ai'`
- [x] 30 AI calls/user/hour enforced in `ai_runs`
- [x] No `dangerouslySetInnerHTML` on AI output
- [x] All Gemini output passes Zod before use
- [x] CSP, nosniff, DENY framing, referrer/permissions policies via `next.config.mjs`

## Testing

- **Unit (87 tests)**: date/timezone math, conflict overlap, prayer schedule validation,
  capture/task/event Zod schemas, context-engine rules, RRULE expansion, AI tool-safety
  (no delete tool, preview-before-execute).
- **Integration**: Gemini client against a mocked fetch (request shape, schema gating,
  tool calls, embeddings).
- **E2E (Playwright)**: auth, text capture→confirm→task, poster image→event→calendar,
  conflict dialog, prayer import→daily map, semantic memory search, assistant proposal
  confirm, RLS anon-sees-nothing check.

## Deployment

### Vercel

1. Import the repository into Vercel.
2. The `vercel.json` at the repository root handles framework, build, and region config
   automatically. No extra configuration is needed in the Vercel dashboard.
3. Set environment variables per environment:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `NEXT_PUBLIC_APP_URL` — the canonical URL of your deployment (e.g.
     `https://shanaya-os.vercel.app`). Used as the base for magic-link and OAuth redirects.
4. Vercel runs `npm run build` automatically.
4. Edge Functions are not bundled by Vercel from this repo. They are deployed to the
   Supabase project with `supabase functions deploy` and configured with
   `supabase secrets set`.

Do not set `GEMINI_API_KEY` as a Vercel environment variable for the frontend app. Gemini is
called from Supabase Edge Functions only, and the key should live there as a function secret.

### Supabase project

- One project per environment is recommended.
- Migrations are applied with `supabase db push`.
- Functions are deployed with `supabase functions deploy`.
- Function secrets are set with `supabase secrets set`.

### Local deployment surface

```bash
npm run dev          # dev server
npm run build        # production build
npm run start        # run the production build locally
npm run start:local  # env-aware local start helper
npm run start:prod   # run the standalone server locally after build
```

`start:local` checks `.env.local` before starting. `start:prod` runs the compiled standalone
server after `npm run build`.

### CI

A GitHub push to the default branch triggers the existing CI:

- lint
- typecheck
- unit tests
- build
- migrate staging
- e2e on staging
- manual promote to production

## Design system

Single source of truth: [`docs/DESIGN.md`](docs/DESIGN.md) — one green accent (Grove
`#166534`), zinc neutrals, Geist + Geist Mono for every time-like value, 16/12/pill shape
lock, Phosphor icons, no emojis, no invented numbers.
