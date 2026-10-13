'use client';

/**
 * WeekView: 7-day columns with hour rows; overlapping blocks stack by index.
 * Conflicts are still decided server-side before any insert.
 */
import * as React from 'react';
import { useRouter } from 'next/navigation';
import type { CalendarEntry } from '@/components/calendar/MonthView';
import { calendarKey, DEFAULT_TZ, formatTime } from '@/lib/utils/dates';
import { cn } from '@/lib/utils/cn';

const DAY_START = 7;
const DAY_END = 23;
const HOUR_HEIGHT = 44;

function startOfWeek(d: Date): Date {
  const day = (d.getDay() + 6) % 7;
  const s = new Date(d);
  s.setHours(0, 0, 0, 0);
  s.setDate(s.getDate() - day);
  return s;
}

export function WeekView({
  events,
  timezone = DEFAULT_TZ,
}: {
  events: CalendarEntry[];
  timezone?: string;
}) {
  const router = useRouter();
  const [weekStart, setWeekStart] = React.useState(() => startOfWeek(new Date()));
  const todayKey = calendarKey(new Date(), timezone);

  const days = React.useMemo(
    () => Array.from({ length: 7 }, (_, i) => new Date(weekStart.getTime() + i * 86_400_000)),
    [weekStart],
  );

  const hours = React.useMemo(
    () => Array.from({ length: DAY_END - DAY_START }, (_, i) => DAY_START + i),
    [],
  );

  function topFor(date: Date): number {
    const h = date.getHours() + date.getMinutes() / 60;
    return (Math.max(DAY_START, Math.min(DAY_END, h)) - DAY_START) * HOUR_HEIGHT;
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-surface">
      <header className="flex items-center justify-between border-b border-line px-3 py-2">
        <button
          type="button"
          onClick={() => setWeekStart((d) => new Date(d.getTime() - 7 * 86_400_000))}
          className="rounded-full px-2 py-1 text-xs font-medium text-muted hover:text-ink"
        >
          Previous
        </button>
        <p className="text-sm font-semibold tracking-tight">
          Week of {days[0]?.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
        </p>
        <button
          type="button"
          onClick={() => setWeekStart((d) => new Date(d.getTime() + 7 * 86_400_000))}
          className="rounded-full px-2 py-1 text-xs font-medium text-muted hover:text-ink"
        >
          Next
        </button>
      </header>

      <div className="grid grid-cols-[36px_repeat(7,1fr)]">
        {/* hour gutter */}
        <div className="relative" style={{ height: hours.length * HOUR_HEIGHT }}>
          {hours.map((h) => (
            <span
              key={h}
              className="absolute right-1 -translate-y-1/2 font-mono text-[10px] tabular text-muted"
              style={{ top: (h - DAY_START) * HOUR_HEIGHT }}
            >
              {String(h).padStart(2, '0')}
            </span>
          ))}
        </div>

        {days.map((day) => {
          const key = day.toISOString().slice(0, 10);
          const dayEvents = events.filter(
            (e) => calendarKey(new Date(e.start_at), timezone) === key,
          );
          return (
            <div
              key={key}
              className={cn(
                'relative border-l border-line',
                key === todayKey && 'bg-grove-tint/40',
              )}
              style={{ height: hours.length * HOUR_HEIGHT }}
            >
              {hours.map((h) => (
                <div
                  key={h}
                  className="border-b border-line/60"
                  style={{ height: HOUR_HEIGHT }}
                  aria-hidden="true"
                />
              ))}
              {dayEvents.map((e, idx) => {
                const start = new Date(e.start_at);
                const end = new Date(e.end_at);
                const top = topFor(start);
                const height = Math.max(
                  22,
                  ((end.getTime() - start.getTime()) / 3_600_000) * HOUR_HEIGHT,
                );
                const overlaps = dayEvents.filter(
                  (o) =>
                    o.id !== e.id &&
                    new Date(o.start_at) < end &&
                    new Date(o.end_at) > start,
                ).length;
                return (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => router.push(`/calendar/${e.id}`)}
                    className="absolute overflow-hidden rounded-md border border-grove/30 bg-grove-tint px-1.5 py-1 text-left"
                    style={{
                      top,
                      height,
                      left: 2 + overlaps * 6,
                      right: 2,
                      zIndex: 10 + idx,
                    }}
                    title={e.title}
                  >
                    <span className="block truncate font-mono text-[10px] tabular text-grove">
                      {formatTime(e.start_at, timezone)}
                    </span>
                    <span className="block truncate text-[11px] font-medium text-ink">
                      {e.title}
                    </span>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </section>
  );
}
