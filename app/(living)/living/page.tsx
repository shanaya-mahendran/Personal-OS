import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { LivingPage } from '@/components/living/LivingPage';
import type { LivingUserData } from '@/components/living/LivingPage';

export const dynamic = 'force-dynamic';

interface TaskRow {
  id: string;
  title: string;
  status: string;
  priority: string;
  due_at: string | null;
  project_id: string | null;
  area_id: string | null;
  description: string | null;
  completed_at: string | null;
}

interface EventRow {
  id: string;
  title: string;
  start_at: string;
  end_at: string;
  location: string | null;
}

interface ProjectRow {
  id: string;
  title: string;
  status: string;
  deadline_at: string | null;
}
export default async function LivingHomePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const timezone = 'Asia/Colombo';
  const now = new Date().toISOString();

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, timezone')
    .eq('id', user.id)
    .maybeSingle();

  const tz = profile?.timezone ?? timezone;

  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  const [tasksRes, eventsRes, projectsRes, karateRes, entertainmentRes] = await Promise.all([
    supabase
      .from('tasks')
      .select('id, title, status, priority, due_at, project_id, area_id, description, completed_at')
      .eq('user_id', user.id)
      .neq('status', 'cancelled')
      .neq('status', 'done')
      .order('due_at', { ascending: true, nullsFirst: false })
      .limit(20),
    supabase
      .from('events')
      .select('id, title, start_at, end_at, location')
      .eq('user_id', user.id)
      .neq('status', 'cancelled')
      .lt('start_at', dayEnd.toISOString())
      .gt('end_at', dayStart.toISOString())
      .order('start_at', { ascending: true }),
    supabase
      .from('projects')
      .select('id, title, status, deadline_at')
      .eq('user_id', user.id)
      .neq('status', 'archived')
      .order('deadline_at', { ascending: true, nullsFirst: false })
      .limit(12),
    supabase
      .from('karate_sessions')
      .select('date, duration_min, focus')
      .eq('user_id', user.id)
      .gte('date', new Date().toISOString().slice(0, 10))
      .order('date', { ascending: false })
      .limit(1),
    supabase
      .from('entertainment_logs')
      .select('duration_min')
      .eq('user_id', user.id)
      .eq('date', new Date().toISOString().slice(0, 10)),
  ]);

  const userData: LivingUserData = {
    id: user.id,
    displayName: profile?.display_name ?? null,
    timezone: tz,
  };

  const tasks: TaskRow[] = (tasksRes.data ?? []) as TaskRow[];
  const events: EventRow[] = (eventsRes.data ?? []) as EventRow[];
  const projects: ProjectRow[] = (projectsRes.data ?? []) as ProjectRow[];
  const karateLast: { date: string; duration_min: number; focus: string } | null =
    karateRes.data?.[0] as { date: string; duration_min: number; focus: string } | null ?? null;
  const entertainmentMinutesToday = (entertainmentRes.data ?? []).reduce(
    (s: number, e: { duration_min?: number }) => s + (e.duration_min ?? 0),
    0,
  );

  return (
    <LivingPage
      user={userData}
      now={now}
      tasks={tasks}
      events={events}
      projects={projects}
      karateLast={karateLast}
      entertainmentMinutesToday={entertainmentMinutesToday}
    />
  );
}
