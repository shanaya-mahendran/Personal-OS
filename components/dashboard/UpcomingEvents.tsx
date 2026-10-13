'use client';

/**
 * UpcomingEvents: time-first rows in Geist Mono with relative countdowns.
 */
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/field';
import { Skeleton } from '@/components/ui/skeleton';
import { formatTime, relativeLabel } from '@/lib/utils/dates';

export interface EventItem {
  id: string;
  title: string;
  start_at: string;
  end_at: string;
  location: string | null;
}

export function UpcomingEvents({ events, loading }: { events: EventItem[]; loading?: boolean }) {
  const router = useRouter();

  if (loading) {
    return (
      <Card>
        <CardContent>
          <Skeleton className="mb-3 h-4 w-24" />
          <div className="grid gap-2">
            {[0, 1].map((i) => (
              <Skeleton key={i} className="h-11 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent>
        <div className="mb-1 flex items-baseline justify-between">
          <CardTitle>Coming up</CardTitle>
          <button
            type="button"
            onClick={() => router.push('/calendar')}
            className="text-[11px] font-medium text-muted hover:text-ink"
          >
            Calendar
          </button>
        </div>

        {events.length === 0 ? (
          <EmptyState message="Nothing scheduled yet. Your calendar is clear." />
        ) : (
          <ul className="hairline-divide">
            {events.map((event) => (
              <li key={event.id}>
                <button
                  type="button"
                  onClick={() => router.push(`/calendar/${event.id}`)}
                  className="flex min-h-[44px] w-full items-center gap-3 py-2 text-left"
                >
                  <span className="w-24 shrink-0 font-mono text-xs tabular text-ink">
                    {formatTime(event.start_at)}–{formatTime(event.end_at)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-ink">{event.title}</span>
                    {event.location ? (
                      <span className="block truncate text-[11px] text-muted">{event.location}</span>
                    ) : null}
                  </span>
                  <span className="shrink-0 font-mono text-[11px] tabular text-muted">
                    {relativeLabel(event.start_at)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
