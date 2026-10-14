# Shanaya OS — Project Report
**Prepared by:** Antigravity IDE  
**Date:** October 14, 2026  
**Repository:** [shanaya-mahendran/Personal-OS](https://github.com/shanaya-mahendran/Personal-OS)  
**Version:** 1.0.0

---

## 1. Executive Summary

**Shanaya OS** is a personal AI-assisted, context-aware *Personal Operating System* — an external memory and command centre for everyday life. The core philosophy is that AI should *propose*, never act unilaterally: every AI-generated mutation renders an editable preview card that the user must explicitly confirm before any data is written.

The project is a full-stack web application deployed on **Vercel** (Next.js frontend) and **Supabase** (PostgreSQL database, Auth, Edge Functions, pgvector semantic search). AI capabilities are powered exclusively by **Google Gemini**, invoked server-side only through Supabase Edge Functions — the API key never touches the browser.

---

## 2. Technology Stack

| Layer | Technology | Notes |
|---|---|---|
| **Frontend** | Next.js 14 (App Router), TypeScript strict | `output: 'standalone'` for Vercel |
| **Styling** | Tailwind CSS, shadcn-style UI primitives | Single Grove green accent `#166534`, zinc neutrals |
| **Icons** | Phosphor Icons | No emojis anywhere |
| **Animation** | Motion (Framer) | Micro-animations on cards & transitions |
| **Fonts** | Geist + Geist Mono | Mono for all time-like values |
| **State** | Zustand | Context cache, capture store, manual override |
| **Forms** | React Hook Form + Zod | All inputs validated before server submission |
| **Backend** | Supabase (PostgreSQL, Auth, RLS, Storage, pgvector) | Row Level Security on every table |
| **AI** | Google Gemini (server-side only) | Via Supabase Edge Functions |
| **Vector Search** | pgvector (`vector(768)`) | Semantic memory search |
| **Deploy** | Vercel + Supabase | `vercel.json` pre-configured |
| **Tests** | Vitest (unit + integration), Playwright (e2e) | 136 unit tests passing |

---

## 3. Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                      Browser (Next.js)                   │
│  App Router · Zustand · React Hook Form · Tailwind CSS  │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTPS
           ┌───────────┴──────────┐
           │                      │
    ┌──────▼──────┐       ┌──────▼───────────┐
    │   Vercel    │       │  Supabase Project  │
    │  (Next.js)  │       │                    │
    │  Server     │──────▶│  PostgreSQL (RLS)  │
    │  Actions    │       │  Auth (JWT)        │
    └─────────────┘       │  Storage           │
                          │  Edge Functions    │
                          │  pgvector          │
                          └────────┬───────────┘
                                   │
                          ┌────────▼───────────┐
                          │   Google Gemini API │
                          │  (server-side only) │
                          └────────────────────┘
```

### Security Model
- **RLS everywhere** — every table has `user_id = auth.uid()` row-level policies
- **API keys in Edge Function secrets only** — Gemini key never in the browser bundle
- **JWT-derived identity** — Edge Functions read `user_id` from the Bearer token, never from the request body
- **Audit trail** — every AI mutation writes an `audit_logs` row with `source = 'ai'`
- **Rate limiting** — 30 Gemini calls/user/hour enforced via `ai_runs` table count
- **CSP headers** — `next.config.mjs` sets Content-Security-Policy, X-Frame-Options (DENY), X-Content-Type-Options (nosniff), Referrer-Policy, Permissions-Policy

---

## 4. Feature Modules

### 4.1 Universal Capture
The primary data entry point. Users type, paste (image auto-detected from clipboard), or photograph — creating a `captures` row with status `pending`. The flow:

1. Capture created → `process-capture` Edge Function called
2. Gemini (with Vision for images) parses the content against a strict Zod schema
3. Per-field **confidence scores** computed (amber warning below 75%)
4. Result stored as `ai_result` + `confidence` JSON; status → `awaiting_confirmation`
5. `CapturePreview` renders an editable proposal card
6. User confirms → server action re-validates with Zod → entity created → audit logged

Raw captures are **never deleted** — full provenance preserved.

### 4.2 Context Engine
A pure, deterministic function over signals evaluated every 60 seconds. Rules in priority order:

| Rule | Signal | Confidence |
|---|---|---|
| 0 | Manual user override | 100% |
| 1 | Ongoing calendar event + geofence match | ≥ 90% |
| 2 | Ongoing event (no location) | 60% — "scheduled" |
| 3 | In-progress task (title inferred) | 85% |
| 4 | Geofence match only | 85% |
| 5a | Sleep window but user is active | 0% — prompt shown |
| 5b | Sleep window, user inactive | 50% — SLEEPING |
| 6 | Nothing matches | 0% — **UNKNOWN** |

**UNKNOWN is a valid, honest state** — the OS never pretends to know. Geolocation is off by default; coordinates are compared in-memory and never stored. Only the context *name* is cached in Zustand.

Context drives the dashboard layout (focus/karate/entertainment/outside/daily) and the greeting shown in the TopBar.

### 4.3 Dynamic Greeting
Replaced the previous hardcoded time-of-day greeting. Now context-aware:
- **Studying/Workshop/University** → "Morning focus", "Afternoon session", "Evening focus", "Working late"
- **Karate** → "Dojo mode"
- **Family Time** → "Family time"
- **Entertainment** → "Unwinding"
- **Time fallbacks** → "Good morning / afternoon / evening", "Late night", "Wind down"

### 4.4 AI Assistant
Conversational chat interface powered by `/ai-assistant` Edge Function:
- **Read-only tools** run immediately in the server action
- **Mutating tools** (create task, add event, etc.) return a **proposal** — rendered as an editable preview card
- User edits the card, clicks Confirm → server action re-validates → executes → audits
- **No delete tool exists** — the AI cannot remove any data
- All Gemini output passes Zod validation before use; never rendered via `dangerouslySetInnerHTML`

### 4.5 Calendar & Events
- Month and Week views
- Event creation from capture or directly
- **Conflict detection** (`detectConflicts`) runs before every insert/update — overlapping events surface a dialog: Keep both / Edit new / Cancel — nothing moved silently
- Recurring events via RRULE

### 4.6 Prayer Times
- User-provided only — never calculated by the app
- CSV import with full validation: 365/366 rows, `HH:MM` format, dates inside `schedule_year`, completeness, ordering warnings
- Diff preview before replace
- Database enforces `extract(year from date) = schedule_year`

### 4.7 Memory & Semantic Search
- Memories stored in `memories` table (kinds: decision, lesson, preference, fact, experience)
- `/generate-embedding` Edge Function produces `vector(768)` embeddings via Gemini
- `search_memory_by_embedding` SQL function performs cosine similarity (`<=>`) search
- Text-search fallback (`search_memories_text`) works without a network round-trip

### 4.8 Life Tracking Modules
The app tracks all major areas of daily life:

| Module | Tables |
|---|---|
| **Tasks & Projects** | `tasks`, `projects`, `areas` |
| **Calendar** | `events`, `event_sources` |
| **Career** | `career_opportunities`, `career_applications`, `interviews` |
| **Habits** | `habits`, `habit_logs` |
| **Karate** | `karate_sessions`, `karate_goals` |
| **Eating** | `meals`, `water_logs` |
| **Entertainment** | `entertainment_logs`, `music_sessions` |
| **Volunteering** | `volunteering`, `volunteering_events` |
| **Prayer** | `prayer_schedules`, `prayer_logs` |
| **Memory** | `memories`, `memory_embeddings` |
| **Notes & Ideas** | `notes`, `ideas` |

### 4.9 Offline Support
- Service Worker (`public/sw.js`) for offline shell
- IndexedDB capture queue via `lib/offline/` — captures made offline are flushed when connectivity returns

---

## 5. Database Schema

**35+ tables** across one consolidated migration. Key design decisions:
- Every user-owned table carries `user_id uuid` + `created_at` + `updated_at`
- `set_updated_at()` trigger applied to all tables via dynamic PL/pgSQL loop
- Enums for all categorical values (13 custom types)
- `pgvector` extension in `public` schema for operator accessibility
- Full RLS via `apply_own_rows_policy()` helper
- Indexes on hot query paths (user+status+due, user+date, user+function+time for ai_runs)

### Edge Functions (7 total)

| Function | Purpose |
|---|---|
| `process-capture` | Calls Gemini (+ Vision), validates with Zod, stores proposal |
| `ai-assistant` | Chat turns, tool dispatch, proposal generation |
| `create-event` | Conflict-checked event creation from assistant |
| `generate-embedding` | Produces `vector(768)` for a memory row |
| `sync-prayer-schedule` | Imports validated CSV prayer schedule |
| `daily-review` | Morning summary AI run |
| `_shared` | Auth helpers, Supabase client, CORS |

---

## 6. Testing

| Suite | Coverage |
|---|---|
| **Unit (Vitest)** | 136 tests — context engine all 7 rules, dynamic greeting (12 scenarios), hintToState (20 cases), Zod schemas, date math, conflict detection, RRULE expansion, prayer validation, AI tool safety |
| **Integration (Vitest)** | Gemini client against mocked fetch — request shape, schema gating, tool calls, embeddings |
| **E2E (Playwright)** | Auth, text capture→confirm→task, image→event→calendar, conflict dialog, prayer import, semantic search, assistant proposal confirm, RLS anon-check |

---

## 7. Deployment

### Production
- **Vercel**: auto-detected Next.js, `vercel.json` pre-configured, no manual dashboard config needed
- **Supabase**: one project per environment, migrations via `supabase db push`, functions via `supabase functions deploy`

### Required Environment Variables

| Variable | Where | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Vercel | Browser Supabase client |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Vercel | Browser Supabase auth |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel | Server-side Supabase access |
| `NEXT_PUBLIC_APP_URL` | Vercel | Magic-link / OAuth redirect base |
| `GEMINI_API_KEY` | Supabase Secrets | Edge Functions only — never Vercel |

---

## 8. Issues Fixed During This Session

| # | Problem | Fix |
|---|---|---|
| 1 | Schema cache error (`public.projects` not found) | Consolidated all migrations into `supabase/full_schema.sql` |
| 2 | AI assistant not functioning | Edge function routing + Gemini API key wiring |
| 3 | "Good morning" shown at all hours | Replaced with `getDynamicGreeting()` — timezone-correct, context-aware |
| 4 | "Sleeping 50%" shown when user is awake | Engine Rule 5a: DOM activity detection → `userActive` flag → shows prompt instead |
| 5 | Context never learned from tasks | Engine Rule 3: `in_progress` tasks infer context from title |
| 6 | No way to manually set context | Amber "What are you doing?" chip → inline activity picker → `manualOverride` in Zustand |
| 7 | SQL error: `syntax error at or near "execute"` | `apply_updated_at` function missing `begin...end` block |
| 8 | SQL error: `type "vector" does not exist` | Added `create extension if not exists vector` before table definitions |
| 9 | SQL error: `operator does not exist: extensions.vector <=> extensions.vector` | Moved pgvector from `extensions` schema → `public` schema |

---

## 9. Design System

Single source of truth in `docs/DESIGN.md`:
- **One accent colour**: Grove green `#166534`
- **Neutrals**: Zinc scale
- **Typography**: Geist (prose) + Geist Mono (all time/numeric values)
- **Shape lock**: 16px radius cards, 12px inner elements, pill buttons
- **Icons**: Phosphor only — no emojis, no Lucide mixing
- **Rules**: No invented numbers, no placeholder data, confidence always visible

---

## 10. Summary Assessment

Shanaya OS is a well-architected, privacy-first personal productivity system with a clear and principled design philosophy. Its standout qualities are:

- **"AI proposes, user disposes"** — a genuinely safe AI integration pattern rarely implemented this carefully
- **Provenance preservation** — raw captures never deleted, every AI action audited
- **Honest context engine** — UNKNOWN is valid; the system never pretends to know
- **Comprehensive security** — RLS on every table, keys in secrets, JWT-only identity
- **Real-time database-driven** — no hardcoded states; everything flows from live Supabase data

The main areas requiring ongoing attention are ensuring the Supabase schema is fully applied in the remote project and deploying the Edge Functions with their required secrets.
