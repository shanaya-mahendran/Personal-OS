'use client';

/**
 * Adaptive dashboard (spec §8).
 * The layout is chosen from the context engine result — the dashboard never
 * shows every widget at once, it prioritizes.
 */
import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { NotePencil, Timer, TrendUp } from '@phosphor-icons/react';
import { useContextEngine } from '@/components/context/ContextProvider';
import { layoutFor } from '@/lib/context/engine';
import { ContextBanner } from '@/components/dashboard/ContextBanner';
import { PrayerWidget, type PrayerEntry } from '@/components/dashboard/PrayerWidget';
import { TodayTasks, type TaskItem } from '@/components/dashboard/TodayTasks';
import { UpcomingEvents, type EventItem } from '@/components/dashboard/UpcomingEvents';
import { QuickCapture } from '@/components/dashboard/QuickCapture';
import { NowPlaying, type NowPlayingData } from '@/components/dashboard/NowPlaying';
import { Card, CardContent, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/field';
import { formatDuration } from '@/lib/utils/format';
import { formatTime, isOngoing, minutesUntil, relativeLabel } from '@/lib/utils/dates';

export interface DashboardData {
  timezone: string;
  prayerDate: string;
  prayers: PrayerEntry[] | null;
  tasks: TaskItem[];
  todayEvents: EventItem[];
  nextEvents: EventItem[];
  entertainmentMinutesToday: number;
  music: NowPlayingData | null;
  karate: {
    sessionsThisMonth: number;
    minutesThisMonth: number;
    last: { date: string; focus: string; duration_min: number } | null;
  };
}

const stagger = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};
const item = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 100, damping: 20 } },
};

export function DashboardView({ data }: { data: DashboardData }) {
  const { result, loading } = useContextEngine();
  const router = useRouter();
  const layout = layoutFor(result?.context ?? 'UNKNOWN');

  const ongoing = data.todayEvents.find((e) => isOngoing(e.start_at, e.end_at));
  const next = data.nextEvents[0];

  const headline = ongoing
    ? `${ongoing.title} is happening now`
    : next
      ? `${next.title} in ${minutesUntil(next.start_at) <= 0 ? 'progress' : relativeLabel(next.start_at)}`
      : null;

  const common = (
    <>
      <PrayerWidget
        date={data.prayerDate}
        entries={data.prayers}
        timezone={data.timezone}
        loading={loading}
      />
      <QuickCapture />
    </>
  );

  if (layout === 'focus') {
    return (
      <motion.div variants={stagger} initial="hidden" animate="show" className="grid gap-4">
        <motion.div variants={item}>
          <ContextBanner headline={headline} />
        </motion.div>

        <motion.div variants={item}>
          {ongoing ? (
            <section className="rounded-2xl bg-grove px-4 py-5 text-white dark:text-black">
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] opacity-70">
                Happening now
              </p>
              <p className="mt-1 text-xl font-semibold tracking-tight">{ongoing.title}</p>
              <p className="mt-1 font-mono text-sm tabular opacity-80">
                {formatTime(ongoing.start_at, data.timezone)}–{formatTime(ongoing.end_at, data.timezone)}
                {ongoing.location ? ` · ${ongoing.location}` : ''}
              </p>
              <Link
                href={`/calendar`}
                className="mt-3 inline-block text-sm font-medium underline-offset-4 hover:underline"
              >
                Open calendar
              </Link>
            </section>
          ) : (
            <Card>
              <CardContent>
                <EmptyState message="No event in progress. Check what is next below." />
              </CardContent>
            </Card>
          )}
        </motion.div>

        <motion.div variants={item}>
          <UpcomingEvents events={data.nextEvents.slice(0, 3)} loading={loading} />
        </motion.div>

        <motion.div variants={item} className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={() => router.push('/inbox')}>
            <NotePencil size={16} /> New note
          </Button>
          <Button variant="outline" className="flex-1" onClick={() => router.push('/tasks')}>
            <TrendUp size={16} /> Tasks
          </Button>
        </motion.div>

        <motion.div variants={item}>{common}</motion.div>
      </motion.div>
    );
  }

  if (layout === 'karate') {
    return (
      <motion.div variants={stagger} initial="hidden" animate="show" className="grid gap-4">
        <motion.div variants={item}>
          <ContextBanner headline={headline ?? 'Training time'} />
        </motion.div>

        <motion.div variants={item}>
          <section className="rounded-2xl border border-line bg-surface px-4 py-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">
                  Karate
                </p>
                <p className="mt-1 text-lg font-semibold tracking-tight text-ink">
                  {data.karate.sessionsThisMonth} sessions this month
                </p>
                <p className="font-mono text-xs tabular text-muted">
                  {formatDuration(data.karate.minutesThisMonth)} trained
                </p>
              </div>
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-grove-tint text-grove">
                <Timer size={20} weight="duotone" />
              </span>
            </div>
            <Button className="mt-4 w-full" onClick={() => router.push('/karate')}>
              Start session
            </Button>
          </section>
        </motion.div>

        <motion.div variants={item}>
          <Card>
            <CardContent>
              <CardTitle>Last session</CardTitle>
              {data.karate.last ? (
                <p className="mt-2 text-sm text-ink">
                  <span className="font-mono tabular">{data.karate.last.date}</span> ·{' '}
                  {data.karate.last.focus} ·{' '}
                  <span className="font-mono tabular">{data.karate.last.duration_min}m</span>
                </p>
              ) : (
                <p className="mt-2 text-sm text-muted">No sessions logged yet.</p>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={item}>{common}</motion.div>
      </motion.div>
    );
  }

  if (layout === 'entertainment') {
    return (
      <motion.div variants={stagger} initial="hidden" animate="show" className="grid gap-4">
        <motion.div variants={item}>
          <ContextBanner headline={headline ?? 'Down time'} />
        </motion.div>

        <motion.div variants={item}>
          <Card>
            <CardContent>
              <CardTitle>Entertainment today</CardTitle>
              <p className="mt-1 font-mono text-2xl tabular text-ink">
                {formatDuration(data.entertainmentMinutesToday)}
              </p>
              <button
                type="button"
                onClick={() => router.push('/entertainment')}
                className="mt-2 text-sm font-medium text-grove underline-offset-4 hover:underline"
              >
                Log something
              </button>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={item}>
          <NowPlaying session={data.music} />
        </motion.div>

        <motion.div variants={item}>{common}</motion.div>
      </motion.div>
    );
  }

  if (layout === 'outside') {
    return (
      <motion.div variants={stagger} initial="hidden" animate="show" className="grid gap-4">
        <motion.div variants={item}>
          <ContextBanner headline={headline} />
        </motion.div>

        <motion.div variants={item}>
          <Card>
            <CardContent>
              <CardTitle>{next ? 'Next up' : 'No next event'}</CardTitle>
              {next ? (
                <>
                  <p className="mt-1 text-base font-semibold text-ink">{next.title}</p>
                  <p className="font-mono text-sm tabular text-muted">
                    starts in {relativeLabel(next.start_at)}
                  </p>
                </>
              ) : (
                <p className="mt-2 text-sm text-muted">Nothing else scheduled today.</p>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={item}>
          <NowPlaying session={data.music} />
        </motion.div>

        <motion.div variants={item}>
          <QuickCapture />
        </motion.div>
      </motion.div>
    );
  }

  // daily / unknown / home
  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="grid gap-4">
      <motion.div variants={item}>
        <ContextBanner headline={headline} />
      </motion.div>
      <motion.div variants={item}>{common}</motion.div>
      <motion.div variants={item}>
        <TodayTasks tasks={data.tasks} loading={loading} />
      </motion.div>
      <motion.div variants={item}>
        <UpcomingEvents events={data.nextEvents.slice(0, 4)} loading={loading} />
      </motion.div>
      <motion.div variants={item}>
        <NowPlaying session={data.music} />
      </motion.div>
    </motion.div>
  );
}
