import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { TasksView, type TasksViewData } from '@/components/tasks/TasksView';

export const dynamic = 'force-dynamic';

export default async function TasksPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [tasksRes, areasRes, projectsRes] = await Promise.all([
    supabase
      .from('tasks')
      .select('*')
      .eq('user_id', user.id)
      .neq('status', 'cancelled')
      .order('created_at', { ascending: false })
      .limit(300),
    supabase.from('areas').select('id, name, color').eq('user_id', user.id).order('sort_order'),
    supabase.from('projects').select('id, title, status').eq('user_id', user.id).order('created_at', { ascending: false }),
  ]);

  const data: TasksViewData = {
    tasks: tasksRes.data ?? [],
    areas: areasRes.data ?? [],
    projects: projectsRes.data ?? [],
  };

  return <TasksView data={data} />;
}
