# Design System: Shanaya OS (Personal OS)

> Single source of truth for every screen, component, and interaction in Shanaya OS.
> Derived from the taste-skill suite (`design-taste-frontend`, `stitch-design-taste`,
> `high-end-visual-design`). Regenerate or extend UI only within these rules.

## 0. Design Read

**Reading this as:** multi-module personal product UI (adaptive dashboard plus life-area
modules) for a single power user on a phone, with a calm, Linear-adjacent, content-first
language, leaning toward Tailwind v4 + shadcn/ui + Geist pairing + restrained spring motion.

`taste-skill` scope note: `design-taste-frontend` declares dashboards out of scope for its
landing-page machinery, so its applicable parts (typography discipline, color locks, motion
rules, pre-flight checks) are applied here and the dashboard-specific direction comes from
`stitch-design-taste`. Landing-style surfaces (an install/promo page for the PWA, if ever
built) must re-run the full `design-taste-frontend` pre-flight checklist.

### Dials

| Dial | Value | Why |
|---|---|---|
| `DESIGN_VARIANCE` | 4 | Structured product UI; the adaptive dashboard provides personality through context, not chaotic layout |
| `MOTION_INTENSITY` | 4 | Functional feedback (completion, capture confirmations, context switches); every animation must justify itself |
| `VISUAL_DENSITY` | 6 | Information-forward (prayer map, today, upcoming, capture in one view) but mobile-first breathing room |

## 1. Visual Theme & Atmosphere

A calm, quiet command center for one person's whole life. The atmosphere is a well-kept
paper planner crossed with a focused instrument panel: warm neutral surfaces, one
confident green accent, tabular numerals, and generous rhythm between modules. Nothing
glows, nothing bounces for attention. The interface recedes so today's prayers, tasks,
and next event can come forward. The single most important screen state is **context**:
the dashboard header quietly announces UNIVERSITY, WORKSHOP, KARATE, HOME, or UNKNOWN,
and every module reads calmer or more alert depending on it.

- Density: "Daily App Balanced" (6 of 10)
- Variance: restrained symmetric structure with one asymmetric element per screen
- Motion: fluid spring physics, no cinematic choreography

## 2. Color Palette & Roles

One accent. One neutral family (zinc). Semantic states are functional, never decorative.

| Name | Hex | Role |
|---|---|---|
| Canvas Warm | `#FAFAF9` | App background (stone-50) |
| Surface Pure | `#FFFFFF` | Cards, sheets, capture panel |
| Charcoal Ink | `#18181B` | Primary text (zinc-950, never `#000000`) |
| Muted Steel | `#71717A` | Secondary text, timestamps, metadata |
| Whisper Line | `rgba(24,24,27,0.08)` | 1px hairline borders and dividers |
| Grove Green | `#166534` | THE accent: active prayer, primary actions, focus rings, context chip, task completion |
| Grove Tint | `rgba(22,101,52,0.08)` | Accent wash for selected states and the current-prayer row |

Semantic (functional only, used sparingly): warning `#B45309` (schedule conflicts,
low-confidence AI fields), danger `#B91C1C` (overdue, destructive), info `#1D4ED8`
(never mixed with the accent in one component).

Dark mode (locked at page level, `prefers-color-scheme` respected, user toggle in settings):
Canvas `#09090B`, Surface `#111113`, text `#FAFAF9`, secondary `#A1A1AA`, line
`rgba(250,250,249,0.10)`, Grove Green brightened to `#4ADE80` for AA contrast on dark.

Bans: AI purple/blue neon, gradient buttons, more than one accent per screen, pure black,
warm/cool gray mixing, section-level theme inversion.

## 3. Typography Rules

Sans-only (serif is banned in this product UI). One pairing, loaded via `next/font`.

| Role | Font | Rules |
|---|---|---|
| Display / screen titles | Geist | `tracking-tight`, weight-driven hierarchy, `clamp()` scaling |
| Body / UI text | Geist | 15px base in modules, relaxed leading, 65ch max for prose |
| Numerals & times | Geist Mono | ALL prayer times, dates, durations, counters, streaks |

- Every time-like value (04:48, 18:03, "in 15 min") renders in Geist Mono. This is the
  signature texture of the OS and it keeps columns of prayer times perfectly aligned.
- Hierarchy through weight and color, not size inflation. No gradient text.
- Banned: Inter as identity font, generic serifs, decorative display faces.

## 4. Component Stylings

Shape lock (documented rule, applied everywhere): cards and sheets 16px, inputs 12px,
buttons and chips full-pill. Icons: Phosphor (`@phosphor-icons/react`), 1.5 stroke,
one family everywhere. Emojis are banned in UI chrome, including the prayer and life-area
headers shown in early wireframes; use Phosphor glyphs instead.

- **Prayer Map row:** full-width 52px tap target, mono time left, prayer name, check state
  right. Current prayer gets Grove Tint background and a 2px Grove Green left edge. Completed
  prayers dim to Muted Steel. One tap toggles; haptic-strength press feedback (`scale-[0.98]`).
- **Task row:** 44px tap target, round checkbox, priority as a 3px left edge (danger/warning/
  neutral), area tag as a hairline chip. Completed: strikethrough + dim. No nested cards.
- **Quick Capture:** the persistent bottom input ("What's on your mind?") plus a floating
  speed-dial FAB that springs open into text / camera / voice actions. The FAB is the only
  elevated element on the dashboard.
- **AI proposal sheet (confirmation):** the proposal renders as an editable form inside a
  bottom sheet, with the raw source (poster/text) collapsible above it. Each field shows a
  small confidence meter; fields below 85% confidence get the warning treatment and a
  "Check this" nudge. Primary CTA: "Add to Shanaya OS". Secondary: "Edit". Destructive:
  "Discard". Never auto-confirm.
- **Conflict alert:** inline warning block above the proposal CTA, naming both events with
  mono time ranges. Actions: "Keep both" / "Edit new". The system never silently moves
  existing commitments.
- **Context chip (dynamic island):** a single morphing pill under the greeting that expands
  into the current context card (event, time range, location, confidence). UNKNOWN renders
  as a neutral dot with the label "Unsure", never a guessed activity.
- **Cards:** double-bezel construction (outer shell `bg-black/[0.03]`, hairline ring,
  `p-1.5`, 16px+2.5px concentric radius; inner core `#FFFFFF` with inset top highlight).
  Used only where elevation communicates hierarchy (dashboard tiles, proposal sheet).
  Lists (tasks, prayers, opportunities) use divide hairlines, not card grids.
- **Inputs:** label above, helper below, error in danger color below, focus ring Grove Green
  2px. No placeholder-as-label, no floating labels.
- **Loaders:** skeletal blocks matching final layout shape (prayer rows, task rows). No spinners.
- **Empty states:** one composed sentence + one action ("No tasks for today. Capture
  something below."), never bare "No data".
- **Numbers:** all metrics (water glasses, training hours, application counts) in Geist Mono.
  Never display a number the system did not actually compute.

## 5. Layout Principles

- Mobile-first PWA: single column `< 768px`; content max `max-w-[480px]` on phones,
  `max-w-[720px]` for tablet two-up. No horizontal scroll, ever.
- Bottom tab bar (max 5 items + More sheet) for navigation; height ≤ 72px. Dashboard is
  the first tab; universal capture is reachable from every screen via the FAB.
- Full-height screens use `min-h-[100dvh]`, never `h-screen`.
- CSS Grid for any multi-column module; no `calc()` percentage hacks.
- One screen = one primary job. Dashboard answers "what matters right now"; modules answer
  their own domain. No module dumps every record it owns.
- Each screen may use one asymmetric or contextual element (context chip, current-prayer
  emphasis); everything else stays in a calm vertical rhythm.
- Section spacing: `clamp(1.5rem, 4vw, 2.5rem)` between modules.

## 6. Motion & Interaction

- Engine: Motion (`motion/react`), spring `stiffness: 100, damping: 20`. No linear easing,
  no instant state jumps.
- Justified motion only: prayer check (feedback), proposal sheet enter/exit (state
  transition), context chip morph (state transition), capture FAB spring (hierarchy),
  dashboard mount stagger 60ms/item (hierarchy). Nothing else animates.
- Animate only `transform` and `opacity`. Stagger via `staggerChildren`; motion isolated
  in client-leaf components with `'use client'` and cleanup.
- `prefers-reduced-motion`: all of the above collapse to opacity fades or nothing.
- Long lists never animate on scroll; only mount-stagger ≤ 8 items.

## 7. Anti-Patterns (Banned)

- No emojis anywhere in UI (wireframe emojis become Phosphor icons)
- No Inter, no serifs, no gradient text, no pure black
- No AI-purple glows or neon; no glassmorphism panels (density 6 makes glass noise)
- No three-equal-card rows; no card grids for lists that are naturally rows
- No `h-screen`, no `window.addEventListener("scroll")`, no layout-property animation
- No fake numbers, fake precision, or invented prayer times; times come only from the
  annual schedule table, and the UI says "Schedule not configured" when a year is missing
- No AI copy clichés ("Elevate", "Seamless", "Unlock"); no em-dashes in UI copy; use plain
  sentences ("Workshop starts in 15 minutes", never "Workshop — imminent")
- No custom cursors, no scroll cues, no version badges, no decorative dots
- No silent AI writes: every AI-created record shows its proposal sheet first
- No location pretense: without a geofence match the UI says "scheduled", not "you are here"
- Generic names in mock data ("John Doe", "Acme") are banned; fixtures use realistic
  Sri Lankan context (University of Moratuwa, Asia/Colombo times)

## 8. Pre-Flight (before any screen ships)

Run the `design-taste-frontend` Section 14 checklist adapted to product UI, plus:

- [ ] One accent used identically across the screen (Color Consistency Lock)
- [ ] One radius system: 16px cards / 12px inputs / pill buttons-chips (Shape Lock)
- [ ] All times, dates, counters in Geist Mono
- [ ] All tap targets ≥ 44px; nav single-line, ≤ 72px tall
- [ ] Loading, empty, and error states exist for every data surface
- [ ] AI-proposed data is always behind explicit confirmation
- [ ] Both light and dark themes render with WCAG AA contrast
- [ ] Every animation survives the "one sentence justification" test and reduced motion
