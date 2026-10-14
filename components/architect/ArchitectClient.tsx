'use client';

/**
 * ArchitectClient — the main client component for The Architect feature.
 * Renders:
 *  - PlanDashboard (3-phase progress + goals)
 *  - HabitTracker (today's daily habits)
 *  - PulseSection (15-day review countdown + history)
 *  - MirrorModal (quarterly reflection form)
 *  - NewPlanModal (start a fresh 3-month cycle)
 */
import * as React from 'react';
import { useRouter } from 'next/navigation';
import type { GrowthPlanRow, ReflectionRow, HabitTrackerEntryRow, GrowthPhase } from '@/lib/supabase/types';
import {
  createGrowthPlan,
  submitReflection,
  upsertHabitEntry,
} from '@/lib/actions/architect';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';

// ── Icons (inline SVG for zero-dependency) ───────────────────────────────────

function CheckCircleIcon({ filled = false }: { filled?: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill={filled ? 'currentColor' : 'none'} />
      {filled && <path d="M8 12l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />}
    </svg>
  );
}

function PhaseIcon({ phase }: { phase: GrowthPhase }) {
  if (phase === 'cut_excess') return <span aria-label="Cut Excess" className="text-lg">✂️</span>;
  if (phase === 'build_foundation') return <span aria-label="Build Foundation" className="text-lg">🏗️</span>;
  return <span aria-label="Broaden Horizons" className="text-lg">🚀</span>;
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface Goal {
  title: string;
  phase: GrowthPhase;
  done: boolean;
}

interface Props {
  plan: GrowthPlanRow | null;
  reflections: ReflectionRow[];
  habitEntries: HabitTrackerEntryRow[];
  taskCompletionToday: number;
}

// ── Phase config ──────────────────────────────────────────────────────────────

const PHASES: { value: GrowthPhase; label: string; month: number; color: string }[] = [
  { value: 'cut_excess', label: 'Cut Excess', month: 1, color: '#e05b5b' },
  { value: 'build_foundation', label: 'Build Foundation', month: 2, color: '#e09f2e' },
  { value: 'broaden_horizons', label: 'Broaden Horizons', month: 3, color: '#3bba8c' },
];

const DEFAULT_HABITS_BY_PHASE: Record<GrowthPhase, string[]> = {
  cut_excess: ['Limit social media (30 min)', 'No phone before 8 AM', 'Track 1 habit you want to break'],
  build_foundation: ['Wake up at same time daily', 'Complete non-negotiable task first', '10-min reflection journal'],
  broaden_horizons: ['Work on a stretch goal', 'Learn something new today', 'Reach out to someone valuable'],
};

// ── Quarterly mirror questions ─────────────────────────────────────────────────

const QUARTERLY_QS = [
  { slug: 'busy_work', q: 'What do I do just to look busy?' },
  { slug: 'procrastinating', q: 'What am I putting off that I know matters?' },
  { slug: 'repeated_pattern', q: 'What patterns of behaviour do I keep repeating?' },
  { slug: 'current_reality', q: 'Where am I honestly right now?' },
  { slug: 'desired_reality', q: 'Where should I be in 3 months?' },
  { slug: 'gap_reason', q: 'What is the real reason for that gap?' },
];

const PULSE_QS = [
  { slug: 'progress', q: 'What have I done to get closer to the life I want?' },
  { slug: 'weakness', q: 'Where have I shown weakness?' },
  { slug: 'change', q: 'What will I change starting tomorrow?' },
];

// ── Helper: days since last reflection ───────────────────────────────────────

function daysSince(reflections: ReflectionRow[], kind: ReflectionRow['kind']): number | null {
  const last = reflections.find((r) => r.kind === kind);
  if (!last) return null;
  const ms = Date.now() - new Date(last.created_at).getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

// ── Sub-components ────────────────────────────────────────────────────────────

function PhaseProgress({ plan }: { plan: GrowthPlanRow }) {
  const goals = (plan.goals as unknown as Goal[]) ?? [];
  const currentIdx = PHASES.findIndex((p) => p.value === plan.current_phase);

  return (
    <div className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold text-primary">{plan.title}</h2>
        <span className="rounded-full bg-grove/10 px-2.5 py-0.5 text-xs font-medium text-grove">
          Active
        </span>
      </div>

      {/* Phase stepper */}
      <div className="mb-4 flex items-center gap-2">
        {PHASES.map((phase, i) => {
          const isCurrent = phase.value === plan.current_phase;
          const isPast = i < currentIdx;
          return (
            <React.Fragment key={phase.value}>
              <div className="flex flex-1 flex-col items-center gap-1">
                <div
                  className={[
                    'flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-bold transition-all',
                    isCurrent
                      ? 'border-grove bg-grove text-white shadow-md'
                      : isPast
                        ? 'border-grove/40 bg-grove/10 text-grove/60'
                        : 'border-line bg-canvas text-secondary',
                  ].join(' ')}
                >
                  {isPast ? '✓' : phase.month}
                </div>
                <span className={`text-center text-[10px] font-medium leading-tight ${isCurrent ? 'text-grove' : 'text-secondary'}`}>
                  {phase.label}
                </span>
              </div>
              {i < PHASES.length - 1 && (
                <div className={`h-px flex-1 ${i < currentIdx ? 'bg-grove/40' : 'bg-line'}`} />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Goal list */}
      {goals.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium uppercase tracking-wide text-secondary">Goals</p>
          {goals.map((goal, idx) => (
            <div key={idx} className="flex items-start gap-2 text-sm">
              <span className={goal.done ? 'text-grove' : 'text-secondary'}>
                <CheckCircleIcon filled={goal.done} />
              </span>
              <span className={goal.done ? 'text-secondary line-through' : 'text-primary'}>
                {goal.title}
              </span>
              <span className="ml-auto shrink-0">
                <PhaseIcon phase={goal.phase} />
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function HabitTracker({
  plan,
  entries,
}: {
  plan: GrowthPlanRow | null;
  entries: HabitTrackerEntryRow[];
}) {
  const [busy, setBusy] = React.useState<string | null>(null);
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);
  const currentPhase: GrowthPhase = plan?.current_phase ?? 'cut_excess';
  const habits = DEFAULT_HABITS_BY_PHASE[currentPhase];

  async function toggle(habitName: string, currentDone: boolean) {
    setBusy(habitName);
    await upsertHabitEntry({
      plan_id: plan?.id ?? null,
      habit_name: habitName,
      date: today,
      completed: !currentDone,
    });
    router.refresh();
    setBusy(null);
  }

  return (
    <div className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
      <h2 className="mb-3 text-base font-semibold text-primary">Today&apos;s Habits</h2>
      <div className="space-y-2">
        {habits.map((habit) => {
          const entry = entries.find((e) => e.habit_name === habit);
          const done = entry?.completed ?? false;
          return (
            <button
              key={habit}
              type="button"
              disabled={busy === habit}
              onClick={() => void toggle(habit, done)}
              className={[
                'flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition-all',
                done
                  ? 'border-grove/30 bg-grove/8 text-grove'
                  : 'border-line bg-canvas text-primary hover:border-grove/40',
              ].join(' ')}
            >
              <span className={done ? 'text-grove' : 'text-secondary'}>
                <CheckCircleIcon filled={done} />
              </span>
              <span className={done ? 'line-through opacity-70' : ''}>{habit}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PulseCountdown({ reflections }: { reflections: ReflectionRow[] }) {
  const daysSincePulse = daysSince(reflections, 'pulse_check_15d');
  const daysUntilNext = daysSincePulse === null ? 0 : Math.max(0, 15 - daysSincePulse);
  const isDue = daysUntilNext === 0;

  return (
    <div
      className={[
        'rounded-2xl border p-4 shadow-sm',
        isDue
          ? 'border-amber-400/50 bg-amber-50 dark:bg-amber-900/10'
          : 'border-line bg-surface',
      ].join(' ')}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-secondary">
            Black Notebook — Pulse Check
          </p>
          {isDue ? (
            <p className="mt-0.5 text-base font-semibold text-amber-600 dark:text-amber-400">
              Due now — Time for your 15-day review
            </p>
          ) : (
            <p className="mt-0.5 text-base font-semibold text-primary">
              Next check in {daysUntilNext} day{daysUntilNext !== 1 ? 's' : ''}
            </p>
          )}
        </div>
        <div
          className={[
            'flex h-12 w-12 items-center justify-center rounded-full text-xl font-bold',
            isDue ? 'bg-amber-400/20 text-amber-600' : 'bg-grove/10 text-grove',
          ].join(' ')}
        >
          {isDue ? '!' : daysUntilNext}
        </div>
      </div>
    </div>
  );
}

function ReflectionHistory({ reflections }: { reflections: ReflectionRow[] }) {
  if (reflections.length === 0) return null;
  return (
    <div className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
      <h2 className="mb-3 text-base font-semibold text-primary">Reflection History</h2>
      <div className="space-y-3">
        {reflections.slice(0, 5).map((r) => (
          <div key={r.id} className="rounded-xl bg-canvas p-3">
            <div className="mb-1 flex items-center justify-between">
              <span className="rounded-full bg-grove/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-grove">
                {r.kind === 'pulse_check_15d' ? '15-Day Check' : 'Quarterly Mirror'}
              </span>
              {r.completion_rate !== null && (
                <span className="text-xs text-secondary">{r.completion_rate}% tasks done</span>
              )}
            </div>
            {r.ai_insights && (
              <p className="mt-1.5 text-sm leading-relaxed text-primary line-clamp-3">
                {r.ai_insights}
              </p>
            )}
            <p className="mt-1 text-[11px] text-secondary">
              {new Date(r.created_at).toLocaleDateString()}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Modal: Reflection form ────────────────────────────────────────────────────

function ReflectionModal({
  kind,
  planId,
  onClose,
}: {
  kind: 'quarterly_mirror' | 'pulse_check_15d';
  planId: string | null;
  onClose: () => void;
}) {
  const questions = kind === 'pulse_check_15d' ? PULSE_QS : QUARTERLY_QS;
  const [answers, setAnswers] = React.useState<Record<string, string>>(() =>
    Object.fromEntries(questions.map((q) => [q.slug, ''])),
  );
  const [step, setStep] = React.useState(0);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const router = useRouter();

  const current = questions[step];
  if (!current) return null;
  const isLast = step === questions.length - 1;

  async function submit() {
    setError(null);
    setBusy(true);
    const res = await submitReflection({ kind, plan_id: planId, answers });
    setBusy(false);
    if (!res.ok) { setError(res.error ?? 'Could not save'); return; }
    router.refresh();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center">
      <div className="w-full max-w-md rounded-2xl bg-surface p-6 shadow-2xl">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-primary">
            {kind === 'pulse_check_15d' ? '15-Day Pulse Check' : 'Quarterly Mirror'}
          </h2>
          <button type="button" onClick={onClose} className="text-secondary hover:text-primary">✕</button>
        </div>
        <p className="mb-4 text-xs text-secondary">
          Question {step + 1} of {questions.length}
        </p>

        {/* Progress dots */}
        <div className="mb-5 flex gap-1.5">
          {questions.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-colors ${i <= step ? 'bg-grove' : 'bg-line'}`}
            />
          ))}
        </div>

        <p className="mb-3 text-base font-medium text-primary">{current.q}</p>
        <Textarea
          id={`reflection-answer-${current.slug}`}
          value={answers[current.slug]}
          onChange={(e) => setAnswers((a) => ({ ...a, [current.slug]: e.target.value }))}
          placeholder="Be honest with yourself…"
          rows={4}
          className="mb-4"
        />
        {error && <p className="mb-3 text-sm text-danger">{error}</p>}
        <div className="flex gap-2">
          {step > 0 && (
            <Button type="button" variant="ghost" onClick={() => setStep((s) => s - 1)}>
              Back
            </Button>
          )}
          <div className="flex-1" />
          {isLast ? (
            <Button
              type="button"
              disabled={busy || !(answers[current.slug] ?? '').trim()}
              onClick={() => void submit()}
            >
              {busy ? 'Saving…' : 'Submit'}
            </Button>
          ) : (
            <Button
              type="button"
              disabled={!(answers[current.slug] ?? '').trim()}
              onClick={() => setStep((s) => s + 1)}
            >
              Next
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Modal: New plan ───────────────────────────────────────────────────────────

function NewPlanModal({ onClose }: { onClose: () => void }) {
  const [title, setTitle] = React.useState('3-Month Growth Plan');
  const [goalInputs, setGoalInputs] = React.useState([
    { title: '', phase: 'cut_excess' as GrowthPhase },
  ]);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const goals = goalInputs
      .filter((g) => g.title.trim())
      .map((g) => ({ ...g, done: false }));
    const res = await createGrowthPlan({ title, goals });
    setBusy(false);
    if (!res.ok) { setError(res.error ?? 'Failed'); return; }
    router.refresh();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center">
      <div className="w-full max-w-md rounded-2xl bg-surface p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-primary">Start a New 3-Month Plan</h2>
          <button type="button" onClick={onClose} className="text-secondary hover:text-primary">✕</button>
        </div>
        <form onSubmit={(e) => void submit(e)} className="space-y-4">
          <div>
            <label htmlFor="plan-title" className="mb-1 block text-sm font-medium text-secondary">
              Plan Title
            </label>
            <Input
              id="plan-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              required
            />
          </div>
          <div>
            <p className="mb-2 text-sm font-medium text-secondary">Goals (optional)</p>
            <div className="space-y-2">
              {goalInputs.map((g, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    value={g.title}
                    onChange={(e) =>
                      setGoalInputs((gs) =>
                        gs.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)),
                      )
                    }
                    placeholder="Goal title…"
                    maxLength={300}
                    className="flex-1"
                  />
                  <select
                    value={g.phase}
                    onChange={(e) =>
                      setGoalInputs((gs) =>
                        gs.map((x, j) =>
                          j === i ? { ...x, phase: e.target.value as GrowthPhase } : x,
                        ),
                      )
                    }
                    className="rounded-lg border border-line bg-canvas px-2 py-1 text-xs text-primary"
                  >
                    {PHASES.map((p) => (
                      <option key={p.value} value={p.value}>
                        M{p.month}: {p.label}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
              {goalInputs.length < 10 && (
                <button
                  type="button"
                  onClick={() =>
                    setGoalInputs((gs) => [...gs, { title: '', phase: 'cut_excess' }])
                  }
                  className="text-sm text-grove hover:underline"
                >
                  + Add goal
                </button>
              )}
            </div>
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy || !title.trim()}>
              {busy ? 'Creating…' : 'Start Plan'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function ArchitectClient({ plan, reflections, habitEntries, taskCompletionToday }: Props) {
  const [modal, setModal] = React.useState<'new_plan' | 'mirror' | 'pulse' | null>(null);
  const daysSincePulse = daysSince(reflections, 'pulse_check_15d');
  const daysSinceMirror = daysSince(reflections, 'quarterly_mirror');

  return (
    <>
      <div className="space-y-4 pb-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-primary">The Architect</h1>
            <p className="text-sm text-secondary">Your intelligent growth system</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setModal('new_plan')}
            className="shrink-0 text-sm"
          >
            {plan ? 'New Cycle' : 'Start Plan'}
          </Button>
        </div>

        {/* No plan state */}
        {!plan && (
          <div className="rounded-2xl border-2 border-dashed border-line p-8 text-center">
            <p className="text-4xl">📐</p>
            <p className="mt-3 text-base font-semibold text-primary">No active growth plan</p>
            <p className="mt-1 text-sm text-secondary">
              Start a 3-month plan to track your growth across the three phases.
            </p>
            <Button
              type="button"
              onClick={() => setModal('new_plan')}
              className="mt-4"
            >
              Create my plan
            </Button>
          </div>
        )}

        {/* Active plan */}
        {plan && (
          <>
            <PhaseProgress plan={plan} />
            <HabitTracker plan={plan} entries={habitEntries} />
          </>
        )}

        {/* Today's score */}
        <div className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-secondary">
                Today&apos;s Task Score
              </p>
              <p className="mt-0.5 text-2xl font-bold text-primary">{taskCompletionToday}%</p>
            </div>
            <div className="h-12 w-12 overflow-hidden rounded-full border-4 border-grove/20">
              <div
                className="h-full w-full rounded-full bg-grove transition-all"
                style={{ opacity: taskCompletionToday / 100 }}
              />
            </div>
          </div>
        </div>

        {/* Pulse countdown + actions */}
        <PulseCountdown reflections={reflections} />

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setModal('pulse')}
            className="flex flex-col items-start gap-1 rounded-2xl border border-line bg-surface p-4 text-left shadow-sm transition-all hover:border-grove/40 active:scale-95"
          >
            <span className="text-xl">📓</span>
            <span className="text-sm font-semibold text-primary">15-Day Check</span>
            <span className="text-[11px] text-secondary">
              {daysSincePulse === null ? 'Never done' : `${daysSincePulse}d ago`}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setModal('mirror')}
            className="flex flex-col items-start gap-1 rounded-2xl border border-line bg-surface p-4 text-left shadow-sm transition-all hover:border-grove/40 active:scale-95"
          >
            <span className="text-xl">🪞</span>
            <span className="text-sm font-semibold text-primary">Quarterly Mirror</span>
            <span className="text-[11px] text-secondary">
              {daysSinceMirror === null ? 'Never done' : `${daysSinceMirror}d ago`}
            </span>
          </button>
        </div>

        {/* Reflection history */}
        <ReflectionHistory reflections={reflections} />
      </div>

      {/* Modals */}
      {modal === 'new_plan' && <NewPlanModal onClose={() => setModal(null)} />}
      {modal === 'pulse' && (
        <ReflectionModal
          kind="pulse_check_15d"
          planId={plan?.id ?? null}
          onClose={() => setModal(null)}
        />
      )}
      {modal === 'mirror' && (
        <ReflectionModal
          kind="quarterly_mirror"
          planId={plan?.id ?? null}
          onClose={() => setModal(null)}
        />
      )}
    </>
  );
}
