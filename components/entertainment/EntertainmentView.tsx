'use client';

/**
 * Entertainment log (spec §13): category + duration; the dashboard shows
 * "Entertainment Today: Xh Ym" computed from these rows.
 *
 * Premium treatment: warm cinematic list with category glyphs, duration chips,
 * and an active-now music session banner.
 */
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Plus, GameController, MusicNote, Play, Book, Heart, Television, FilmReel } from '@phosphor-icons/react';
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

const CATEGORY_GLYPH: Record<EntertainmentCategory, typeof GameController> = {
  movie: FilmReel,
  tv: Television,
  anime: FilmReel,
  game: GameController,
  music: MusicNote,
  youtube: Play,
  book: Book,
  social: Heart,
};

const CATEGORY_LABEL: Record<EntertainmentCategory, string> = {
  movie: 'Film',
  tv: 'TV',
  anime: 'Anime',
  game: 'Game',
  music: 'Music',
  youtube: 'Video',
  book: 'Book',
  social: 'Social',
};

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
            Today: {formatDuration(todayMinutes)}
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
                        {CATEGORY_LABEL[c]}
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
                  placeholder="What did you watch, play, or read?"
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
        <div className="living-bezel-glow flex items-center gap-3 rounded-2xl px-4 py-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-living-gold-soft">
            <MusicNote size={18} className="text-living-gold" weight="fill" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-living-ink">
              {activeSession.track ?? 'Listening now'}
            </p>
            <p className="truncate text-xs text-living-muted">
              {activeSession.artist ?? ''}
            </p>
          </div>
          <span className="rounded-full bg-living-gold-soft px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wider text-living-gold">
            {activeSession.mood ?? 'Now'}
          </span>
        </div>
      ) : null}

      {logs.length === 0 ? (
        <div className="rounded-2xl border border-line bg-surface">
          <EmptyState message="Nothing logged this week. Add what you enjoyed." />
        </div>
      ) : (
        <ul className="hairline-divide rounded-2xl border border-line bg-surface">
          {logs.map((l) => {
            const Glyph = CATEGORY_GLYPH[l.category] ?? FilmReel;
            return (
              <li key={l.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-grove-tint">
                  <Glyph size={15} weight="duotone" className="text-grove" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">{l.title}</p>
                  <div className="flex items-center gap-2 font-mono text-[11px] tabular text-muted">
                    <span>{CATEGORY_LABEL[l.category]}</span>
                    <span aria-hidden="true">·</span>
                    <span>{formatDuration(l.duration_min)}
                      .
                      {l.date}
                    </span>
                  </div>
                </div>
                <span className="font-mono text-xs tabular text-ink">
                  {formatDuration(l.duration_min)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
