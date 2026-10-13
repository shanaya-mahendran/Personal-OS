import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { DashboardView, type DashboardData } from '@/components/dashboard/DashboardView';
import type { PrayerEntry } from '@/components/dashboard/PrayerWidget';
import type { TaskItem } from '@/components/dashboard/TodayTasks';
import type { EventItem } from '@/components/dashboard/UpcomingEvents';
import type { NowPlayingData } from '@/components/dashboard/NowPlaying';
import { PRAYERS } from '@/lib/prayer/lookup';
import { calendarKey, DEFAULT_TZ } from '@/lib/utils/dates';

export const dynamic = 'force-dynamic';

/**
 * Dashboard: gathers today's data server-side, then hands it to the
 * context-driven adaptive layout.
 */
export default async function DashboardPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const timezone = DEFAULT_TZ;
  const today = calendarKey(new Date(), timezone);
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [profileRes, scheduleRes, logsRes, tasksRes, eventsRes, areasRes, musicRes, entRes, karateRes] =
    await Promise.all([
      supabase.from('profiles').select('timezone').eq('id', user.id).maybeSingle(),
      supabase
        .from('prayer_schedules')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', today)
        .maybeSingle(),
      supabase.from('prayer_logs').select('prayer, completed').eq('user_id', user.id).eq('date', today),
      supabase
        .from('tasks')
        .select('id, title, status, priority, due_at, area_id')
        .eq('user_id', user.id)
        .neq('status', 'cancelled')
        .neq('status', 'done')
        .order('due_at', { ascending: true, nullsFirst: false })
        .limit(8),
      supabase
        .from('events')
        .select('id, title, start_at, end_at, location')
        .eq('user_id', user.id)
        .neq('status', 'cancelled')
        .lt('start_at', end.toISOString())
        .gt('end_at', start.toISOString())
        .order('start_at', { ascending: true }),
      supabase.from('areas').select('id, name').eq('user_id', user.id),
      supabase
        .from('music_sessions')
        .select('track, artist, mood, started_at')
        .eq('user_id', user.id)
        .is('ended_at', null)
        .maybeSingle(),
      supabase
        .from('entertainment_logs')
        .select('duration_min')
        .eq('user_id', user.id)
        .eq('date', today),
      supabase
        .from('karate_sessions')
        .select('date, focus, duration_min')
        .eq('user_id', user.id)
        .gte('date', monthStart.toISOString().slice(0, 10))
        .order('date', { ascending: false }),
    ]);

  const tz = profileRes.data?.timezone ?? DEFAULT_TZ;

  // Prayer entries + completion state.
  let prayers: PrayerEntry[] | null = null;
  const sched = scheduleRes.data;
  if (sched) {
    const completed = new Set(
      (logsRes.data ?? []).filter((l) => l.completed).map((l) => l.prayer),
    );
    prayers = PRAYERS.map((p) => ({
      prayer: p,
      time: String(sched[p]).slice(0, 5),
      completed: completed.has(p),
    }));
  }

  // Tasks with area names (client-side join to avoid a select join).
  const areaNames = new Map((areasRes.data ?? []).map((a) => [a.id, a.name]));
  const tasks: TaskItem[] = (tasksRes.data ?? [])
    .filter((t) => !t.due_at || new Date(t.due_at).getTime() <= end.getTime())
    .map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      priority: t.priority,
      due_at: t.due_at,
      area_name: t.area_id ? (areaNames.get(t.area_id) ?? null) : null,
    }));

  const allEvents = (eventsRes.data ?? []) as EventItem[];
  const nowMs = Date.now();
  const todayEvents = allEvents.filter((e) => new Date(e.end_at).getTime() >= nowMs);
  const nextEvents = allEvents.filter((e) => new Date(e.start_at).getTime() >= nowMs);

  const karateRows = karateRes.data ?? [];
  const karate = {
    sessionsThisMonth: karateRows.length,
    minutesThisMonth: karateRows.reduce((sum, k) => sum + (k.duration_min ?? 0), 0),
    last: karateRows[0]
      ? {
          date: karateRows[0].date,
          focus: karateRows[0].focus,
          duration_min: karateRows[0].duration_min,
        }
      : null,
  };

  const data: DashboardData = {
    timezone: tz,
    prayerDate: today,
    prayers,
    tasks,
    todayEvents,
    nextEvents,
    entertainmentMinutesToday: (entRes.data ?? []).reduce((s, e) => s + e.duration_min, 0),
    music: musicRes.data
      ? ({
          track: musicRes.data.track,
          artist: musicRes.data.artist,
          mood: musicRes.data.mood,
          started_at: musicRes.data.started_at,
        } satisfies NowPlayingData)
      : null,
    karate,
  };

  return <DashboardView data={data} />;
}
