'use client';

/**
 * MonthView: a calm month grid; events shown as time-first entries.
 * All date math runs in the user's timezone via calendarKey helpers.
 */
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { CaretLeft, CaretRight } from '@phosphor-icons/react';
import { calendarKey, DEFAULT_TZ } from '@/lib/utils/dates';
import { cn } from '@/lib/utils/cn';

export interface CalendarEntry {
  id: string;
  title: string;
  start_at: string;
  end_at: string;
  location: string | null;
  status: string;
}

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

function monthGrid(year: number, month: number): Date[] {
  // month: 0-based. Returns cells starting Monday.
  const first = new Date(Date.UTC(year, month, 1));
  const startOffset = (first.getUTCDay() + 6) % 7;
  const cells: Date[] = [];
  const start = new Date(Date.UTC(year, month, 1 - startOffset));
  for (let i = 0; i < 42; i++) {
    cells.push(new Date(start.getTime() + i * 86_400_000));
  }
  return cells;
}

export function MonthView({
  events,
  timezone = DEFAULT_TZ,
  onSelectDate,
}: {
  events: CalendarEntry[];
  timezone?: string;
  onSelectDate?: (key: string) => void;
}) {
  const router = useRouter();
  const [cursor, setCursor] = React.useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  const cells = React.useMemo(
    () => monthGrid(cursor.year, cursor.month),
    [cursor],
  );

  const todayKey = calendarKey(new Date(), timezone);

  const byDay = React.useMemo(() => {
    const map = new Map<string, CalendarEntry[]>();
    for (const e of events) {
      const key = calendarKey(new Date(e.start_at), timezone);
      const list = map.get(key) ?? [];
      list.push(e);
      map.set(key, list);
    }
    return map;
  }, [events, timezone]);

  const monthLabel = new Intl.DateTimeFormat('en-GB', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(cursor.year, cursor.month, 15)));

  return (
    <section className="rounded-2xl border border-line bg-surface p-3">
      <header className="mb-2 flex items-center justify-between">
        <button
          type="button"
          aria-label="Previous month"
          onClick={() =>
            setCursor((c) =>
              c.month === 0 ? { year: c.year - 1, month: 11 } : { year: c.year, month: c.month - 1 },
            )
          }
          className="rounded-full p-2 text-muted hover:bg-black/[0.05] hover:text-ink"
        >
          <CaretLeft size={15} />
        </button>
        <p className="text-sm font-semibold tracking-tight">{monthLabel}</p>
        <button
          type="button"
          aria-label="Next month"
          onClick={() =>
            setCursor((c) =>
              c.month === 11 ? { year: c.year + 1, month: 0 } : { year: c.year, month: c.month + 1 },
            )
          }
          className="rounded-full p-2 text-muted hover:bg-black/[0.05] hover:text-ink"
        >
          <CaretRight size={15} />
        </button>
      </header>

      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS.map((d) => (
          <span key={d} className="py-1 text-[10px] font-medium uppercase text-muted">
            {d}
          </span>
        ))}
        {cells.map((date) => {
          const key = date.toISOString().slice(0, 10);
          const inMonth = date.getUTCMonth() === cursor.month;
          const isToday = key === todayKey;
          const dayEvents = byDay.get(key) ?? [];
          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelectDate?.(key)}
              className={cn(
                'flex min-h-[52px] flex-col items-center gap-0.5 rounded-lg border px-1 py-1 transition-colors',
                isToday ? 'border-grove bg-grove-tint' : 'border-transparent hover:bg-black/[0.03]',
                !inMonth && 'opacity-40',
              )}
              aria-label={`${key}, ${dayEvents.length} events`}
            >
              <span
                className={cn(
                  'font-mono text-xs tabular',
                  isToday ? 'font-semibold text-grove' : 'text-ink',
                )}
              >
                {date.getUTCDate()}
              </span>
              <span className="flex flex-wrap justify-center gap-0.5">
                {dayEvents.slice(0, 3).map((e) => (
                  <span
                    key={e.id}
                    className="h-1.5 w-1.5 rounded-full bg-grove"
                    aria-hidden="true"
                  />
                ))}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-3 border-t border-line pt-2">
        <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted">
          {todayKey}
        </p>
        {(byDay.get(todayKey) ?? []).length === 0 ? (
          <button
            type="button"
            onClick={() => router.push('/calendar?new=1')}
            className="text-sm text-muted hover:text-ink"
          >
            Nothing today. Add an event.
          </button>
        ) : (
          <ul className="hairline-divide">
            {(byDay.get(todayKey) ?? []).map((e) => (
              <li key={e.id}>
                <button
                  type="button"
                  onClick={() => router.push(`/calendar/${e.id}`)}
                  className="flex min-h-[40px] w-full items-center gap-3 text-left"
                >
                  <span className="font-mono text-xs tabular text-ink">
                    {new Date(e.start_at).toLocaleTimeString('en-GB', {
                      hour: '2-digit',
                      minute: '2-digit',
                      timeZone: timezone,
                    })}
                  </span>
                  <span className="truncate text-sm text-ink">{e.title}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
