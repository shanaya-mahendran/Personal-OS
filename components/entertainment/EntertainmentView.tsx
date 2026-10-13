'use client';

/**
 * Entertainment log (spec §13): category + duration; the dashboard shows
 * "Entertainment Today: Xh Ym" computed from these rows.
 */
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Plus, MusicNoteSimple } from '@phosphor-icons/react';
import type { EntertainmentLogRow, MusicSessionRow, EntertainmentCategory } from '@/lib/supabase/types';
import { EntertainmentLogCreateSchema } from '@/lib/validation/career';
import { createEntertainmentLog } from '@/lib/actions/modules';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field, EmptyState } from '@/components/ui/field';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatDuration } from '@/lib/utils/format';

const CATEGORIES: EntertainmentCategory[] = [
  'movie',
  'tv',
  'anime',
  'game',
  'music',
  'youtube',
  'book',
  'social',
];

export function EntertainmentView({
  today,
  logs,
  activeSession,
}: {
  today: string;
  logs: EntertainmentLogRow[];
  activeSession: MusicSessionRow | null;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState({
    category: 'movie' as EntertainmentCategory,
    title: '',
    duration_min: '',
  });
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const todayMinutes = logs
    .filter((l) => l.date === today)
    .reduce((sum, l) => sum + l.duration_min, 0);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = EntertainmentLogCreateSchema.safeParse({
      date: today,
      category: form.category,
      title: form.title.trim(),
      duration_min: form.duration_min,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Check the form');
      return;
    }
    setBusy(true);
    const res = await createEntertainmentLog(parsed.data);
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? 'Could not save');
      return;
    }
    setOpen(false);
    setForm({ ...form, title: '', duration_min: '' });
    router.refresh();
  }

  return (
    <div className="mx-auto grid max-w-[560px] gap-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Entertainment</h1>
          <p className="font-mono text-sm tabular text-muted">
            Entertainment today: {formatDuration(todayMinutes)}
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus size={15} /> Log
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Log entertainment</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => void submit(e)} className="grid gap-3">
              <Field label="Category" htmlFor="e-cat">
                <Select
                  value={form.category}
                  onValueChange={(v) => setForm({ ...form, category: v as EntertainmentCategory })}
                >
                  <SelectTrigger id="e-cat">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c[0]!.toUpperCase() + c.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Title" htmlFor="e-title" required>
                <Input
                  id="e-title"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  required
                  placeholder="What did you watch/play/read?"
                />
              </Field>
              <Field label="Minutes" htmlFor="e-mins" required>
                <Input
                  id="e-mins"
                  type="number"
                  min={1}
                  max={1440}
                  value={form.duration_min}
                  onChange={(e) => setForm({ ...form, duration_min: e.target.value })}
                  required
                />
              </Field>
              {error ? <p className="text-sm text-danger">{error}</p> : null}
              <Button type="submit" disabled={busy}>
                {busy ? 'Saving…' : 'Save log'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </header>

      {activeSession ? (
        <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3">
          <MusicNoteSimple size={18} className="text-grove" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-ink">
              {activeSession.track ?? 'Unknown track'}
            </p>
            <p className="truncate text-xs text-muted">{activeSession.artist ?? 'Listening now'}</p>
          </div>
          <span className="text-[11px] uppercase text-muted">{activeSession.mood}</span>
        </div>
      ) : null}

      {logs.length === 0 ? (
        <div className="rounded-2xl border border-line bg-surface">
          <EmptyState message="Nothing logged this week. Add what you enjoyed." />
        </div>
      ) : (
        <ul className="hairline-divide rounded-2xl border border-line bg-surface">
          {logs.map((l) => (
            <li key={l.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm text-ink">{l.title}</p>
                <p className="font-mono text-[11px] tabular text-muted">
                  {l.date} · {l.category}
                </p>
              </div>
              <span className="font-mono text-xs tabular text-ink">
                {formatDuration(l.duration_min)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
