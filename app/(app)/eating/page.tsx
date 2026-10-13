import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { EatingView } from '@/components/eating/EatingView';
import { calendarKey, DEFAULT_TZ } from '@/lib/utils/dates';

export const dynamic = 'force-dynamic';

/**
 * Eating: daily checklist (Breakfast/Lunch/Dinner/Snacks) + water counter.
 * No calorie counting in v1 (spec §13).
 */
export default async function EatingPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const today = calendarKey(new Date(), DEFAULT_TZ);
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);

  const [mealsRes, waterRes] = await Promise.all([
    supabase
      .from('meals')
      .select('*')
      .eq('user_id', user.id)
      .gte('date', weekAgo)
      .order('date', { ascending: false }),
    supabase.from('water_logs').select('*').eq('user_id', user.id).gte('date', weekAgo),
  ]);

  return (
    <EatingView
      today={today}
      meals={mealsRes.data ?? []}
      water={waterRes.data ?? []}
    />
  );
}
