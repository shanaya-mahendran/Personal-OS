import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { PrayerWidget, type PrayerEntry } from '@/components/dashboard/PrayerWidget';
import { PRAYERS } from '@/lib/prayer/lookup';
import { calendarKey, DEFAULT_TZ, formatDate } from '@/lib/utils/dates';

export const dynamic = 'force-dynamic';

/**
 * Prayer daily map (spec §9): five rows for today driven by the imported
 * annual schedule. Completion is stored independently in prayer_logs.
 */
export default async function PrayersPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const today = calendarKey(new Date(), DEFAULT_TZ);
  const year = Number(today.slice(0, 4));

  const [profileRes, scheduleRes, logsRes, coverageRes] = await Promise.all([
    supabase.from('profiles').select('timezone').eq('id', user.id).maybeSingle(),
    supabase
      .from('prayer_schedules')
      .select('*')
      .eq('user_id', user.id)
      .eq('date', today)
      .maybeSingle(),
    supabase.from('prayer_logs').select('prayer, completed').eq('user_id', user.id).eq('date', today),
    supabase
      .from('prayer_schedules')
      .select('date', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('schedule_year', year),
  ]);

  const tz = profileRes.data?.timezone ?? DEFAULT_TZ;
  const sched = scheduleRes.data;
  let entries: PrayerEntry[] | null = null;
  if (sched) {
    const completed = new Set(
      (logsRes.data ?? []).filter((l) => l.completed).map((l) => l.prayer),
    );
    entries = PRAYERS.map((p) => ({
      prayer: p,
      time: String(sched[p]).slice(0, 5),
      completed: completed.has(p),
    }));
  }

  const daysConfigured = coverageRes.count ?? 0;
  const expected = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 366 : 365;

  return (
    <div className="mx-auto grid max-w-[560px] gap-4">
      <header>
        <p className="text-[11px] font-medium uppercase tracking-widest text-muted">Prayers</p>
        <h1 className="mt-1 text-xl font-semibold tracking-tight">{formatDate(today, tz)}</h1>
        <p className="text-sm text-muted">
          {daysConfigured > 0
            ? `${year} schedule: ${daysConfigured}/${expected} days configured`
            : `No schedule imported for ${year}`}
        </p>
      </header>

      <PrayerWidget date={today} entries={entries} timezone={tz} />

      <div className="rounded-2xl border border-line bg-surface p-4">
        <p className="text-sm text-muted">
          Times come only from your imported annual schedule. Shanaya OS never calculates prayer
          times from your location.
        </p>
        <Link
          href="/prayers/schedule"
          className="mt-3 inline-block text-sm font-medium text-grove underline-offset-4 hover:underline"
        >
          {daysConfigured > 0 ? 'Manage annual schedule' : 'Import annual schedule'}
        </Link>
      </div>
    </div>
  );
}
