'use client';

/**
 * Karate: session log + stats + goals (spec §13).
 * All metrics are computed from real rows, never invented.
 */
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Target } from '@phosphor-icons/react';
import type { KarateSessionRow, KarateGoalRow } from '@/lib/supabase/types';
import { KarateSessionCreateSchema } from '@/lib/validation/career';
import { createKarateSession, createKarateGoal } from '@/lib/actions/modules';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field, EmptyState } from '@/components/ui/field';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatDuration } from '@/lib/utils/format';

const FOCUS_OPTIONS = ['kata', 'kumite', 'conditioning', 'technique', 'grading', 'competition'] as const;

export function KarateView({
  sessions,
  goals,
}: {
  sessions: KarateSessionRow[];
  goals: KarateGoalRow[];
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [goalOpen, setGoalOpen] = React.useState(false);
  const [form, setForm] = React.useState({
    date: new Date().toISOString().slice(0, 10),
    duration_min: '',
    focus: 'technique',
    notes: '',
  });
  const [goalForm, setGoalForm] = React.useState({ title: '', target_date: '', progress: '0' });
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const monthPrefix = new Date().toISOString().slice(0, 7);
  const monthSessions = sessions.filter((s) => s.date.startsWith(monthPrefix));
  const totalMinutes = monthSessions.reduce((sum, s) => sum + s.duration_min, 0);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = KarateSessionCreateSchema.safeParse({
      date: form.date,
      duration_min: form.duration_min,
      focus: form.focus,
      notes: form.notes.trim() || null,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Check the form');
      return;
    }
    setBusy(true);
    const res = await createKarateSession(parsed.data);
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? 'Could not save');
      return;
    }
    setOpen(false);
    setForm({ ...form, duration_min: '', notes: '' });
    router.refresh();
  }

  async function submitGoal(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await createKarateGoal({
      title: goalForm.title.trim(),
      target_date: goalForm.target_date || null,
      progress: Number(goalForm.progress),
    });
    if (!res.ok) {
      setError(res.error ?? 'Could not save goal');
      return;
    }
    setGoalOpen(false);
    setGoalForm({ title: '', target_date: '', progress: '0' });
    router.refresh();
  }

  return (
    <div className="grid gap-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Karate</h1>
          <p className="font-mono text-sm tabular text-muted">
            {monthSessions.length} sessions this month · {formatDuration(totalMinutes)} trained
          </p>
        </div>
        <div className="flex gap-2">
          <Dialog open={goalOpen} onOpenChange={setGoalOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">
                <Target size={15} />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New goal</DialogTitle>
              </DialogHeader>
              <form onSubmit={(e) => void submitGoal(e)} className="grid gap-3">
                <Field label="Title" htmlFor="kg-title" required>
                  <Input
                    id="kg-title"
                    value={goalForm.title}
                    onChange={(e) => setGoalForm({ ...goalForm, title: e.target.value })}
                    required
                  />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Target date" htmlFor="kg-date">
                    <Input
                      id="kg-date"
                      type="date"
                      value={goalForm.target_date}
                      onChange={(e) => setGoalForm({ ...goalForm, target_date: e.target.value })}
                    />
                  </Field>
                  <Field label="Progress %" htmlFor="kg-progress">
                    <Input
                      id="kg-progress"
                      type="number"
                      min={0}
                      max={100}
                      value={goalForm.progress}
                      onChange={(e) => setGoalForm({ ...goalForm, progress: e.target.value })}
                    />
                  </Field>
                </div>
                <Button type="submit" disabled={busy}>Save goal</Button>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus size={15} /> Log session
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Log training session</DialogTitle>
              </DialogHeader>
              <form onSubmit={(e) => void submit(e)} className="grid gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Date" htmlFor="k-date" required>
                    <Input
                      id="k-date"
                      type="date"
                      value={form.date}
                      onChange={(e) => setForm({ ...form, date: e.target.value })}
                      required
                    />
                  </Field>
                  <Field label="Minutes" htmlFor="k-mins" required>
                    <Input
                      id="k-mins"
                      type="number"
                      min={1}
                      max={600}
                      value={form.duration_min}
                      onChange={(e) => setForm({ ...form, duration_min: e.target.value })}
                      required
                    />
                  </Field>
                </div>
                <Field label="Focus" htmlFor="k-focus">
                  <Select value={form.focus} onValueChange={(v) => setForm({ ...form, focus: v })}>
                    <SelectTrigger id="k-focus">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FOCUS_OPTIONS.map((f) => (
                        <SelectItem key={f} value={f}>
                          {f[0]!.toUpperCase() + f.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Notes" htmlFor="k-notes">
                  <Input
                    id="k-notes"
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  />
                </Field>
                {error ? <p className="text-sm text-danger">{error}</p> : null}
                <Button type="submit" disabled={busy}>
                  {busy ? 'Saving…' : 'Save session'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      {goals.length > 0 ? (
        <ul className="grid gap-2">
          {goals.map((g) => (
            <li key={g.id} className="rounded-xl border border-line bg-surface px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-ink">{g.title}</span>
                <span className="font-mono text-xs tabular text-muted">
                  {Number(g.progress)}%
                </span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
                <div
                  className="h-full rounded-full bg-grove transition-all"
                  style={{ width: `${Math.min(100, Number(g.progress))}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {sessions.length === 0 ? (
        <div className="rounded-2xl border border-line bg-surface">
          <EmptyState message="No sessions logged yet. Log your next training." />
        </div>
      ) : (
        <ul className="hairline-divide rounded-2xl border border-line bg-surface">
          {sessions.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium capitalize text-ink">{s.focus}</p>
                <p className="font-mono text-[11px] tabular text-muted">{s.date}</p>
              </div>
              <span className="font-mono text-xs tabular text-ink">{s.duration_min}m</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
