'use client';

/**
 * PrayerWidget: today's five prayers with completion toggles.
 * The current/next prayer gets the Grove Tint background + 2px left edge.
 * Times come only from the imported schedule; without one we say so.
 */
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Check } from '@phosphor-icons/react';
import { togglePrayer } from '@/lib/actions/prayer';
import { currentPrayer } from '@/lib/prayer/lookup';
import type { PrayerName } from '@/lib/supabase/types';
import { Card, CardContent, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils/cn';

const PRAYER_LABELS: Record<PrayerName, string> = {
  fajr: 'Fajr',
  dhuhr: 'Dhuhr',
  asr: 'Asr',
  maghrib: 'Maghrib',
  isha: 'Isha',
};

export interface PrayerEntry {
  prayer: PrayerName;
  time: string;
  completed: boolean;
}

export function PrayerWidget({
  date,
  entries,
  timezone,
  loading,
}: {
  date: string;
  entries: PrayerEntry[] | null;
  timezone: string;
  loading?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<PrayerName | null>(null);

  const times = React.useMemo(() => {
    if (!entries) return null;
    return Object.fromEntries(entries.map((e) => [e.prayer, e.time])) as Record<PrayerName, string>;
  }, [entries]);

  const { current, next } = React.useMemo(
    () => (times ? currentPrayer(times, new Date(), timezone) : { current: null, next: null }),
    [times, timezone],
  );

  if (loading) {
    return (
      <Card>
        <CardContent>
          <Skeleton className="mb-3 h-4 w-24" />
          <div className="grid gap-2">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-11 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!entries) {
    return (
      <Card>
        <CardContent>
          <CardTitle>Prayers</CardTitle>
          <p className="mt-2 text-sm text-muted">
            Schedule not configured for this year. Import your annual schedule to see times.
          </p>
          <button
            type="button"
            onClick={() => router.push('/prayers/schedule')}
            className="mt-3 text-sm font-medium text-grove underline-offset-4 hover:underline"
          >
            Import schedule
          </button>
        </CardContent>
      </Card>
    );
  }

  async function toggle(prayer: PrayerName, completed: boolean) {
    setBusy(prayer);
    await togglePrayer({ date, prayer, completed });
    setBusy(null);
    router.refresh();
  }

  return (
    <Card>
      <CardContent>
        <div className="mb-2 flex items-baseline justify-between">
          <CardTitle>Prayers</CardTitle>
          <span className="font-mono text-[11px] tabular text-muted">{date}</span>
        </div>
        <ul className="hairline-divide">
          {entries.map((entry) => {
            const isCurrent = entry.prayer === current;
            const isNext = entry.prayer === next;
            return (
              <li key={entry.prayer}>
                <button
                  type="button"
                  disabled={busy === entry.prayer}
                  onClick={() => void toggle(entry.prayer, !entry.completed)}
                  className={cn(
                    'flex h-[52px] w-full items-center gap-3 px-2 text-left transition-transform active:scale-[0.98]',
                    isCurrent && 'rounded-lg bg-grove-tint',
                    isCurrent && 'border-l-2 border-grove pl-3',
                  )}
                >
                  <span
                    className={cn(
                      'w-14 font-mono text-sm tabular',
                      entry.completed ? 'text-muted' : 'text-ink',
                    )}
                  >
                    {entry.time}
                  </span>
                  <span
                    className={cn(
                      'flex-1 text-sm font-medium',
                      entry.completed ? 'text-muted line-through' : 'text-ink',
                      isNext && !entry.completed && 'text-grove',
                    )}
                  >
                    {PRAYER_LABELS[entry.prayer]}
                  </span>
                  <span
                    className={cn(
                      'flex h-6 w-6 items-center justify-center rounded-full border transition-colors',
                      entry.completed
                        ? 'border-grove bg-grove text-white'
                        : 'border-line bg-surface text-transparent',
                    )}
                    aria-hidden="true"
                  >
                    <Check size={13} weight="bold" />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
