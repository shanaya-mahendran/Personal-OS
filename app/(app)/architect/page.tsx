import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ArchitectClient } from '@/components/architect/ArchitectClient';
import type { GrowthPlanRow, ReflectionRow, HabitTrackerEntryRow } from '@/lib/supabase/types';

export const dynamic = 'force-dynamic';

export default async function ArchitectPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const today = new Date().toISOString().slice(0, 10);

  const [planRes, reflectionsRes, habitRes, taskStatsRes] = await Promise.all([
    supabase
      .from('growth_plans')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1),
    supabase
      .from('reflections')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10),
    supabase
      .from('habit_tracker_entries')
      .select('*')
      .eq('user_id', user.id)
      .eq('date', today),
    supabase
      .from('tasks')
      .select('status')
      .eq('user_id', user.id)
      .gte('created_at', `${today}T00:00:00Z`)
      .lt('created_at', `${today}T23:59:59Z`),
  ]);

  const tasksToday = taskStatsRes.data ?? [];
  const doneToday = tasksToday.filter((t) => t.status === 'done').length;
  const taskCompletionToday =
    tasksToday.length > 0 ? Math.round((doneToday / tasksToday.length) * 100) : 0;

  return (
    <ArchitectClient
      plan={(planRes.data?.[0] as GrowthPlanRow) ?? null}
      reflections={(reflectionsRes.data ?? []) as ReflectionRow[]}
      habitEntries={(habitRes.data ?? []) as HabitTrackerEntryRow[]}
      taskCompletionToday={taskCompletionToday}
    />
  );
}
