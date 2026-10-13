import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ScheduleImporter } from '@/components/prayer/ScheduleImporter';

export const dynamic = 'force-dynamic';

/**
 * Annual schedule import (spec §9): CSV or manual grid, validation,
 * diff preview, then a single write. Old years stay archived (read-only).
 */
export default async function PrayerSchedulePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: years } = await supabase
    .from('prayer_schedules')
    .select('schedule_year')
    .eq('user_id', user.id)
    .order('schedule_year', { ascending: false })
    .limit(10);

  const { data: counts } = await supabase
    .from('prayer_schedules')
    .select('schedule_year', { count: 'exact' })
    .eq('user_id', user.id);

  const coverage = new Map<number, number>();
  for (const row of counts ?? []) {
    coverage.set(row.schedule_year, (coverage.get(row.schedule_year) ?? 0) + 1);
  }

  const existingYears = Array.from(
    new Set((years ?? []).map((r) => r.schedule_year)),
  ).map((year) => ({ year, days: coverage.get(year) ?? 0 }));

  return <ScheduleImporter existingYears={existingYears} />;
}
