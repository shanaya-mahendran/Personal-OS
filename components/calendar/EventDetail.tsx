'use client';

/**
 * Event detail: edit form + provenance (source capture) display.
 */
import * as React from 'react';
import type { EventRow } from '@/lib/supabase/types';
import { EventForm } from '@/components/calendar/EventForm';
import { Badge } from '@/components/ui/badge';
import { formatDate, formatTime, relativeLabel } from '@/lib/utils/dates';

export function EventDetail({ event }: { event: EventRow }) {
  return (
    <div className="mx-auto grid max-w-[560px] gap-4">
      <header>
        <p className="text-[11px] font-medium uppercase tracking-widest text-muted">Event</p>
        <h1 className="mt-1 text-xl font-semibold tracking-tight">{event.title}</h1>
        <p className="mt-1 font-mono text-xs tabular text-muted">
          {formatDate(event.start_at, event.timezone)} {formatTime(event.start_at, event.timezone)}–
          {formatTime(event.end_at, event.timezone)} · {relativeLabel(event.start_at)}
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Badge variant="secondary">{event.status}</Badge>
          <Badge variant="default">{event.timezone}</Badge>
          {event.source_id ? <Badge variant="info">From capture</Badge> : null}
        </div>
      </header>

      <EventForm event={event} />
    </div>
  );
}
