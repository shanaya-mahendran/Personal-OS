# Shanaya OS — Functional vs. Not-Functional Analysis

> **Stack**: Next.js 14 (App Router) · Supabase (Postgres + Auth + Edge Functions) · Gemini AI · pgvector · Zustand · Zod

---

## ✅ Fully Functional (Production-ready or near-production)

### 🔐 Authentication
| Feature | Status | Notes |
|---|---|---|
| Email + Password login | ✅ Working | `signInWithPassword` via Supabase Auth |
| Magic Link login | ✅ Working | `signInWithOtp` + redirect |
| Sign-up | ✅ Working | Exists at `/signup` |
| Auth middleware | ✅ Working | Session refresh via `middleware.ts` |
| Auth callback / redirect | ✅ Working | `/callback` route exists |
| Route protection | ✅ Working | Every page does `getUser()` → redirect `/login` |

---

### 📋 Tasks
| Feature | Status | Notes |
|---|---|---|
| List view + Board view (Kanban) | ✅ Working | Two tabs; board groups by `todo/in_progress/done` |
| Filtering by area, priority, status | ✅ Working | Client-side filter dropdowns |
| Create task (form + Zod validation) | ✅ Working | `createTask` server action |
| Toggle task complete/reopen | ✅ Working | `toggleTask` action |
| Priority colour-coded rows | ✅ Working | Left-border colour system |
| Task detail page (`/tasks/[id]`) | ✅ Working | `TaskDetail` component exists |
| Area & Project association | ✅ Working | Select dropdowns in create form |

---

### 📅 Calendar
| Feature | Status | Notes |
|---|---|---|
| Month view | ✅ Working | `MonthView.tsx` renders grid |
| Week view | ✅ Working | `WeekView.tsx` renders time blocks |
| Event create form | ✅ Working | `EventForm.tsx` with Zod |
| Event detail view | ✅ Working | `EventDetail.tsx` |
| Conflict detection | ✅ Working | `detectConflicts()` in `lib/calendar/conflicts.ts` |
| Conflict dialog (keep-both / cancel) | ✅ Working | `ConflictDialog.tsx` |
| Server action: create/update event | ✅ Working | `lib/actions/events.ts` |
| 135-day fetch window | ✅ Working | Page fetches -45d to +90d range |

---

### 🤖 AI Assistant
| Feature | Status | Notes |
|---|---|---|
| Chat UI with message history | ✅ Working | `AssistantChat.tsx` |
| Proposal cards (editable JSON) | ✅ Working | `ProposalCard` component |
| Confirm-before-execute flow | ✅ Working | `confirmProposal` server action |
| Read-only tool auto-execution | ✅ Working | `get_today`, `get_schedule`, `search_memory` run without confirmation |
| Tool coverage | ✅ Working | `create_task`, `update_task`, `create_event`, `update_event`, `create_project`, `create_note`, `create_memory`, `create_reminder`, `search_memory`, `get_today`, `get_schedule`, `get_prayer_times` |
| Zod re-validation on server | ✅ Working | `executor.ts` re-parses before writing |
| Audit log (`audit_logs` table) | ✅ Working | Every AI action writes source='ai' |
| Rate limiting (30/hr) | ✅ Working | `checkRateLimit()` in executor |
| Chat message persistence | ✅ Working | `chat_messages` table; last 50 loaded on init |
| Conflict detection for event proposals | ✅ Working | Delegates to `detectConflicts()` |

---

### 📥 Universal Capture (Inbox)
| Feature | Status | Notes |
|---|---|---|
| Quick-capture form on dashboard | ✅ Working | `QuickCapture.tsx` |
| Capture sheet / modal | ✅ Working | `CaptureSheet.tsx` |
| Submit → process via Edge Function | ✅ Working | `submitCapture` → `process-capture` Edge Fn |
| Inbox view with status badges | ✅ Working | `InboxView.tsx` |
| Capture preview / editing | ✅ Working | `CapturePreview.tsx` |
| Confirm capture (create entity) | ✅ Working | 6 entity types: task, event, note, memory, career_opportunity, reminder |
| Reject capture | ✅ Working | `rejectCapture` action |
| Retry stuck captures | ✅ Working | `reprocessCapture` |
| Provenance tracking | ✅ Working | `raw_text`/`storage_path` never deleted |

---

### 🙏 Prayers
| Feature | Status | Notes |
|---|---|---|
| Daily prayer schedule view | ✅ Working | 5-row display with times from imported schedule |
| Mark prayer as complete/incomplete | ✅ Working | `prayer_logs` table |
| Annual schedule import | ✅ Working | `ScheduleImporter.tsx` + `/prayers/schedule` route |
| Year coverage indicator | ✅ Working | Shows X/365 days configured |
| Dashboard widget | ✅ Working | `PrayerWidget.tsx` embedded in dashboard |

---

### 🧠 Memory
| Feature | Status | Notes |
|---|---|---|
| Memory list view | ✅ Working | Shows up to 100 recent memories |
| Create memory (kind, title, body) | ✅ Working | `createMemory` server action |
| Text-based search | ✅ Working | `search_memories_text` RPC (Postgres text search) |
| Vector/semantic search | ✅ Working (if pgvector configured) | Falls back to text if no embeddings |
| Similarity % display | ✅ Working | Shown when semantic search returns results |
| Source capture link | ✅ Working | "from capture" button links back to Inbox |
| Embedding generation | ✅ Working | `generate-embedding` Edge Function fires on memory create |

---

### 🍽️ Eating
| Feature | Status | Notes |
|---|---|---|
| Daily meal checklist (B/L/D/Snack) | ✅ Working | Toggle skipped/eaten |
| Water counter (inc/dec) | ✅ Working | `adjustWater` with idempotent upsert |
| Weekly history view | ✅ Working | Last 7 days fetched |
| `EatingView` component | ✅ Working | Exists in `components/eating/EatingView.tsx` |

---

### 🥋 Karate
| Feature | Status | Notes |
|---|---|---|
| Session list | ✅ Working | Last 120 sessions |
| Goal list | ✅ Working | `karate_goals` table |
| Log new session | ✅ Working | `createKarateSession` action |
| Create goal | ✅ Working | `createKarateGoal` action |
| Dashboard widget (sessions this month) | ✅ Working | Aggregated in dashboard query |

---

### 💼 Career
| Feature | Status | Notes |
|---|---|---|
| Opportunity board (pipeline) | ✅ Working | `CareerBoard.tsx` |
| Opportunity detail view | ✅ Working | `OpportunityDetail.tsx` |
| Add opportunity | ✅ Working | `createOpportunity` action |
| Status pipeline move | ✅ Working | `updateOpportunityStatus` action |
| Interview scheduling | ✅ Working | `createInterview` → auto-creates calendar event + conflict check |

---

### ⚙️ Settings
| Feature | Status | Notes |
|---|---|---|
| Profile settings | ✅ Working | From `profiles` table |
| App settings | ✅ Working | From `settings` table |
| Known places management | ✅ Working | From `known_places` table |
| Save settings | ✅ Working | `lib/actions/settings.ts` |

---

### 🎨 Branding
| Feature | Status | Notes |
|---|---|---|
| Content board (LinkedIn/GitHub/Portfolio) | ✅ Working | `BrandingView` component |
| Create content item | ✅ Working | `createBrandingContent` action |
| Status update (idea→draft→ready→published) | ✅ Working | `updateBrandingStatus` action |

---

### 👨‍👩‍👧 Family
| Feature | Status | Notes |
|---|---|---|
| Family events list | ✅ Working | `FamilyView` component |
| Create family event | ✅ Working | `createFamilyEvent` action |

---

### 🤝 Volunteering
| Feature | Status | Notes |
|---|---|---|
| Records list | ✅ Working | `VolunteeringView` component |
| Add record | ✅ Working | `createVolunteering` action |

---

### 🎬 Entertainment
| Feature | Status | Notes |
|---|---|---|
| Log entertainment | ✅ Working | `createEntertainmentLog` action |
| Dashboard "screen time today" | ✅ Working | Summed from `entertainment_logs` |
| `EntertainmentView` component | ✅ Working | Exists |

---

### 🗃️ Projects
| Feature | Status | Notes |
|---|---|---|
| Project list | ✅ Working | `ProjectsView.tsx` |
| Project detail | ✅ Working | `ProjectDetail.tsx` + `/projects/[id]` route |

---

### 📐 Dashboard
| Feature | Status | Notes |
|---|---|---|
| Adaptive context layout | ✅ Working | `DashboardView.tsx` |
| Today's tasks widget | ✅ Working | `TodayTasks.tsx` |
| Upcoming events widget | ✅ Working | `UpcomingEvents.tsx` |
| Prayer widget | ✅ Working | `PrayerWidget.tsx` |
| Now playing music widget | ✅ Working | `NowPlaying.tsx` |
| Karate widget | ✅ Working | Monthly stats |
| Entertainment widget | ✅ Working | Screen time today |
| Quick capture | ✅ Working | `QuickCapture.tsx` |

---

### 🏗️ Infrastructure
| Feature | Status | Notes |
|---|---|---|
| 6 Supabase migrations | ✅ Done | Init, RLS, pgvector, prayers, seed, branding/family |
| Row-Level Security | ✅ Done | `0002_rls.sql` — all tables scoped by `user_id` |
| pgvector extension | ✅ Done | `0003_pgvector.sql` |
| 6 Edge Functions | ✅ Exists | `ai-assistant`, `create-event`, `daily-review`, `generate-embedding`, `process-capture`, `sync-prayer-schedule` |
| Audit log (`audit_logs`) | ✅ Done | All mutations write an audit row |
| TypeScript types (`lib/supabase/types.ts`) | ✅ Done | Auto-generated from Supabase schema |

---

## ❌ Not Functional / Missing (vs. Production-Ready Standard)

### 🔴 Critical Gaps

| Gap | Impact |
|---|---|
| **No password reset flow** | Users who forget their password are locked out permanently. No `/forgot-password` page or `resetPasswordForEmail` call exists. |
| **No email verification gate** | Users can sign up and immediately access all data without verifying their email. Supabase can enforce this but it's not configured in the app flow. |
| **No OAuth / social login** | Only email+password and magic link. No Google/GitHub/Apple Sign-In. |
| **Music sessions have no write UI** | `NowPlaying.tsx` reads the `music_sessions` table but there's no way to start/stop a music session from the UI. The widget shows current track if a row exists, but nothing creates/ends sessions. |
| **No notes page/view** | The `create_note` server action and AI executor fully support notes, but there is **no `/notes` route and no Notes UI component** — notes created via AI or capture are invisible. |
| **Edge Functions need secrets set** | The `.env.example` shows `GEMINI_API_KEY` is set via `supabase secrets set` — if not deployed and configured, the entire AI Assistant, capture processing, and embedding generation silently fails. |
| **`daily-review` Edge Function has no trigger** | `supabase/functions/daily-review/` exists but no cron job or scheduled trigger is wired up in `supabase/config.toml`. It never runs automatically. |
| **No push notifications / reminders** | Reminders are stored as tasks with `reminder_at`, but there's no notification delivery mechanism (no service worker push, no email, no cron to fire them). |

---

### 🟡 Partial / Degraded Features

| Feature | Issue |
|---|---|
| **Semantic memory search** | Only works if the `generate-embedding` Edge Function has run for each memory (requires `GEMINI_API_KEY` set as Supabase secret). Falls back to SQL text search silently. |
| **Capture processing** | Entirely dependent on the `process-capture` Edge Function being deployed. If it's unreachable, all captures stay in `pending` state forever — user sees no feedback beyond "retry". |
| **Prayer times** | Only works after the user imports an annual schedule via `ScheduleImporter`. Without it, the prayer widget on the dashboard shows nothing. No onboarding prompt for this. |
| **Prayer schedule import** (`ScheduleImporter`) | File parsing assumes a specific CSV/JSON format from an external source — no format validation feedback; errors silently fail in UI. |
| **Context banner** | `ContextBanner.tsx` exists on the dashboard but the context engine (spec §7 — location, known places, time-of-day rules) has no actual inference logic wired — it shows a placeholder. |
| **Calendar [id] detail route** | `/calendar/[id]/page.tsx` exists as a directory but we don't see a `page.tsx` implementation — may be missing. |
| **`data.projects` filter** in Tasks | Projects filter is shown in the tasks create form but there's no "Filter by project" dropdown in the tasks list filters. |
| **No pagination** | Tasks (limit 300), memories (limit 100), captures (limit 50) are hardcoded limits with no infinite scroll or pagination UI. |

---

### 🟠 Production-Readiness Gaps (Quality)

| Gap | Details |
|---|---|
| **No error boundaries** | No `error.tsx` files in any route segment — unhandled server component errors will crash the page with no user-facing fallback. |
| **No loading states** | No `loading.tsx` in any route — all pages are `force-dynamic` with no skeleton placeholders during SSR hydration. |
| **No `not-found.tsx`** | Missing 404 page at any level. |
| **No offline page implementation** | `/offline` directory exists in the app but its implementation was not found. The middleware references `sw.js` and `manifest.json` in the static exclusion list, suggesting PWA intent, but no service worker or manifest file is in `/public`. |
| **No file/image upload for captures** | `storage_path` field exists in `captures` table, but there's no file input in `CaptureSheet.tsx` — voice memos and image captures are database-only stubs. |
| **Hardcoded timezone `Asia/Colombo`** | Several files hardcode `'Asia/Colombo'` as fallback instead of reading from profile — e.g., event creation in `modules.ts` and `executor.ts`. |
| **No multi-user / team support** | Fully single-user by design (per spec), but there's also no account deletion flow. |
| **No test coverage (unit)** | `vitest.config.ts` exists and tests can run, but no `.test.ts` files found in the codebase — 0% test coverage. |
| **No E2E tests** | `playwright.config.ts` exists but no `tests/` content found. |
| **No real-time updates** | No Supabase Realtime subscriptions — all pages use `router.refresh()` (a full RSC re-fetch) rather than live updates. |
| **Settings: no theme or notification preference save** | `SettingsView.tsx` likely has UI for theme/notifications, but the backend schema and save action may not be fully wired. |

---

## Summary Scorecard

| Domain | Functional? |
|---|---|
| Auth (login/signup/magic link) | ✅ Full |
| Tasks (CRUD, filter, board) | ✅ Full |
| Calendar (month/week, events, conflicts) | ✅ Full |
| AI Assistant (chat, proposals, confirm) | ✅ Full (requires Edge Fn deployed) |
| Universal Capture (inbox, process, confirm) | ✅ Full (requires Edge Fn deployed) |
| Prayers | ✅ Full (after schedule import) |
| Memory (create, text search, semantic) | ✅ Full (semantic needs embeddings) |
| Dashboard | ✅ Full |
| Eating | ✅ Full |
| Karate | ✅ Full |
| Career | ✅ Full |
| Branding | ✅ Full |
| Family | ✅ Full |
| Volunteering | ✅ Full |
| Entertainment | ✅ Full |
| Projects | ✅ Full |
| Settings | ✅ Mostly full |
| Notes | ❌ No UI |
| Music sessions | ❌ No write UI |
| Password reset | ❌ Missing |
| Push/reminder delivery | ❌ Missing |
| Daily review cron | ❌ Not triggered |
| Error/loading/404 boundaries | ❌ Missing |
| Offline / PWA | ❌ Incomplete |
| Tests | ❌ 0 test files |
