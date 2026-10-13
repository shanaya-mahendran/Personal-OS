'use client';

/**
 * EventForm: React Hook Form + Zod create/edit with server-side conflict
 * detection. On conflict, nothing is inserted — ConflictDialog decides.
 */
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { createEvent, updateEvent } from '@/lib/actions/events';
import { deleteEvent } from '@/lib/actions/events';
import { EventCreateSchema } from '@/lib/validation/event';
import type { EventRow } from '@/lib/supabase/types';
import type { OverlappingEvent } from '@/lib/calendar/conflicts';
import { ConflictDialog } from '@/components/calendar/ConflictDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Field } from '@/components/ui/field';
import { Trash } from '@phosphor-icons/react';

function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export interface EventFormValues {
  title: string;
  description: string;
  start_at: string;
  end_at: string;
  location: string;
  organizer: string;
}

export function defaultEventValues(event?: EventRow): EventFormValues {
  if (event) {
    return {
      title: event.title,
      description: event.description ?? '',
      start_at: toLocalInput(event.start_at),
      end_at: toLocalInput(event.end_at),
      location: event.location ?? '',
      organizer: event.organizer ?? '',
    };
  }
  // Default: next hour, in local time.
  const start = new Date();
  start.setMinutes(0, 0, 0);
  start.setHours(start.getHours() + 1);
  const end = new Date(start.getTime() + 60 * 60_000);
  return {
    title: '',
    description: '',
    start_at: toLocalInput(start.toISOString()),
    end_at: toLocalInput(end.toISOString()),
    location: '',
    organizer: '',
  };
}

export function EventForm({ event }: { event?: EventRow }) {
  const router = useRouter();
  const [values, setValues] = React.useState<EventFormValues>(() => defaultEventValues(event));
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [conflict, setConflict] = React.useState<OverlappingEvent[] | null>(null);

  function set<K extends keyof EventFormValues>(key: K, value: string) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function buildPayload(force = false) {
    return {
      title: values.title.trim(),
      description: values.description.trim() || undefined,
      start_at: new Date(values.start_at).toISOString(),
      end_at: new Date(values.end_at).toISOString(),
      location: values.location.trim() || null,
      organizer: values.organizer.trim() || null,
      timezone: 'Asia/Colombo',
      ...(force ? { force: true } : {}),
    };
  }

  async function submit(e?: React.FormEvent, force = false) {
    e?.preventDefault();
    setError(null);

    const parsed = EventCreateSchema.safeParse(buildPayload(force));
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Check the form');
      return;
    }

    setBusy(true);
    const res = event
      ? await updateEvent({ id: event.id, ...parsed.data, ...(force ? { force: true } : {}) })
      : await createEvent(parsed.data);
    setBusy(false);

    if (!res.ok) {
      setError(res.error ?? 'Could not save event');
      return;
    }
    if (res.data?.status === 'conflict') {
      setConflict(res.data.overlapping);
      return;
    }
    router.refresh();
    router.push('/calendar');
  }

  return (
    <>
      <form onSubmit={(e) => void submit(e)} className="grid gap-3">
        <Field label="Title" htmlFor="ev-title" required>
          <Input
            id="ev-title"
            value={values.title}
            onChange={(e) => set('title', e.target.value)}
            required
            maxLength={300}
            placeholder="What is happening?"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Starts" htmlFor="ev-start" required>
            <Input
              id="ev-start"
              type="datetime-local"
              value={values.start_at}
              onChange={(e) => set('start_at', e.target.value)}
              required
            />
          </Field>
          <Field label="Ends" htmlFor="ev-end" required>
            <Input
              id="ev-end"
              type="datetime-local"
              value={values.end_at}
              onChange={(e) => set('end_at', e.target.value)}
              required
            />
          </Field>
        </div>

        <Field label="Location" htmlFor="ev-location">
          <Input
            id="ev-location"
            value={values.location}
            onChange={(e) => set('location', e.target.value)}
            placeholder="Where?"
          />
        </Field>

        <Field label="Organizer" htmlFor="ev-organizer">
          <Input
            id="ev-organizer"
            value={values.organizer}
            onChange={(e) => set('organizer', e.target.value)}
            placeholder="Who runs it?"
          />
        </Field>

        <Field label="Description" htmlFor="ev-desc">
          <Textarea
            id="ev-desc"
            value={values.description}
            onChange={(e) => set('description', e.target.value)}
            rows={3}
          />
        </Field>

        {error ? <p className="text-sm text-danger">{error}</p> : null}

        <div className="flex items-center gap-2">
          <Button type="submit" disabled={busy}>
            {busy ? 'Saving…' : event ? 'Save changes' : 'Create event'}
          </Button>
          {event ? (
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={async () => {
                if (!window.confirm('Delete this event?')) return;
                await deleteEvent(event.id);
                router.push('/calendar');
                router.refresh();
              }}
            >
              <Trash size={15} /> Delete
            </Button>
          ) : null}
        </div>
      </form>

      <ConflictDialog
        open={conflict !== null}
        overlapping={conflict ?? []}
        onKeepBoth={() => void submit(undefined, true)}
        onEditTimes={() => setConflict(null)}
        onCancel={() => setConflict(null)}
      />
    </>
  );
}
