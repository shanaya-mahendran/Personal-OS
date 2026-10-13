'use client';

/**
 * Family: records of gatherings/visits/tasks plus upcoming family events.
 */
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from '@phosphor-icons/react';
import type { FamilyEventRow, FamilyKind } from '@/lib/supabase/types';
import { createFamilyEvent } from '@/lib/actions/modules';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field, EmptyState } from '@/components/ui/field';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatDate, formatTime } from '@/lib/utils/dates';
import { z } from 'zod';

const FamilyCreateSchema = z.object({
  title: z.string().trim().min(1).max(300),
  kind: z.enum(['gathering', 'visit', 'task', 'celebration', 'other']),
  event_date: z.string().nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
});

const KINDS: FamilyKind[] = ['gathering', 'visit', 'task', 'celebration', 'other'];

interface UpcomingEvent {
  id: string;
  title: string;
  start_at: string;
  location: string | null;
}

export function FamilyView({
  records,
  upcoming,
}: {
  records: FamilyEventRow[];
  upcoming: UpcomingEvent[];
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [title, setTitle] = React.useState('');
  const [kind, setKind] = React.useState<FamilyKind>('gathering');
  const [eventDate, setEventDate] = React.useState('');
  const [notes, setNotes] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = FamilyCreateSchema.safeParse({
      title: title.trim(),
      kind,
      event_date: eventDate || null,
      notes: notes.trim() || null,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Check the form');
      return;
    }
    setBusy(true);
    const res = await createFamilyEvent(parsed.data);
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? 'Could not save');
      return;
    }
    setOpen(false);
    setTitle('');
    setNotes('');
    setEventDate('');
    router.refresh();
  }

  return (
    <div className="mx-auto grid max-w-[560px] gap-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Family</h1>
          <p className="text-sm text-muted">{records.length} records</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus size={15} /> Add
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New family record</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => void submit(e)} className="grid gap-3">
              <Field label="Title" htmlFor="f-title" required>
                <Input
                  id="f-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  placeholder="Sunday lunch at Amma's"
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Kind" htmlFor="f-kind">
                  <Select value={kind} onValueChange={(v) => setKind(v as FamilyKind)}>
                    <SelectTrigger id="f-kind">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {KINDS.map((k) => (
                        <SelectItem key={k} value={k}>
                          {k[0]!.toUpperCase() + k.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Date" htmlFor="f-date">
                  <Input
                    id="f-date"
                    type="date"
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                  />
                </Field>
              </div>
              <Field label="Notes" htmlFor="f-notes">
                <Input id="f-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
              </Field>
              {error ? <p className="text-sm text-danger">{error}</p> : null}
              <Button type="submit" disabled={busy}>
                {busy ? 'Saving…' : 'Save record'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </header>

      {upcoming.length > 0 ? (
        <section className="rounded-2xl border border-line bg-surface p-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
            Coming up on your calendar
          </p>
          <ul className="hairline-divide">
            {upcoming.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="truncate text-ink">{e.title}</span>
                <span className="font-mono text-[11px] tabular text-muted">
                  {formatDate(e.start_at)} {formatTime(e.start_at)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {records.length === 0 ? (
        <div className="rounded-2xl border border-line bg-surface">
          <EmptyState message="No family records yet. Add the next gathering or task." />
        </div>
      ) : (
        <ul className="hairline-divide rounded-2xl border border-line bg-surface">
          {records.map((r) => (
            <li key={r.id} className="px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <p className="truncate text-sm font-medium text-ink">{r.title}</p>
                <span className="shrink-0 rounded-full border border-line px-2 py-0.5 text-[10px] capitalize text-muted">
                  {r.kind}
                </span>
              </div>
              <p className="font-mono text-[11px] tabular text-muted">
                {r.event_date ? formatDate(r.event_date) : 'no date'}
                {r.notes ? ` · ${r.notes}` : ''}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
