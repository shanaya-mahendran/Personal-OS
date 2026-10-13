/**
 * Prayer schedule lookup (spec §9).
 * Times come only from user-imported rows; there is no calculation path.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, PrayerName, PrayerScheduleRow } from '@/lib/supabase/types';
import { calendarKey, DEFAULT_TZ, timeToMinutes } from '@/lib/utils/dates';

export const PRAYERS: PrayerName[] = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];

export interface DayPrayerTimes {
  date: string;
  times: Record<PrayerName, string> | null;
}

export async function getScheduleForDate(
  supabase: SupabaseClient<Database>,
  userId: string,
  date: string,
): Promise<PrayerScheduleRow | null> {
  const { data } = await supabase
    .from('prayer_schedules')
    .select('*')
    .eq('user_id', userId)
    .eq('date', date)
    .maybeSingle();
  return data;
}

export async function hasYear(
  supabase: SupabaseClient<Database>,
  userId: string,
  year: number,
): Promise<boolean> {
  const { count } = await supabase
    .from('prayer_schedules')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('schedule_year', year);
  return (count ?? 0) > 0;
}

export interface PrayerState {
  prayer: PrayerName;
  time: string;
  minutes: number;
  passed: boolean;
  current: PrayerName | null;
  next: PrayerName | null;
}

/**
 * Which prayer is current/next given now in the user's timezone.
 * - current: the latest prayer whose time has passed today
 * - next: first prayer still ahead today (null after isha)
 */
export function currentPrayer(
  times: Record<PrayerName, string>,
  now: Date = new Date(),
  timeZone: string = DEFAULT_TZ,
): { current: PrayerName | null; next: PrayerName | null } {
  const nowMinutes = timeToMinutes(
    new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone,
    }).format(now),
  );

  let current: PrayerName | null = null;
  let next: PrayerName | null = null;
  for (const p of PRAYERS) {
    const m = timeToMinutes(times[p]);
    if (m <= nowMinutes) current = p;
    else if (next === null) next = p;
  }
  return { current, next };
}

/** Today's schedule or null when the year is not configured. */
export async function getTodayPrayers(
  supabase: SupabaseClient<Database>,
  userId: string,
  timeZone: string = DEFAULT_TZ,
): Promise<DayPrayerTimes> {
  const date = calendarKey(new Date(), timeZone);
  const row = await getScheduleForDate(supabase, userId, date);
  if (!row) return { date, times: null };
  return {
    date,
    times: {
      fajr: row.fajr,
      dhuhr: row.dhuhr,
      asr: row.asr,
      maghrib: row.maghrib,
      isha: row.isha,
    },
  };
}
