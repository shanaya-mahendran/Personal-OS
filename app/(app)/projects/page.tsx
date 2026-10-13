import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ProjectsView } from '@/components/projects/ProjectsView';

export const dynamic = 'force-dynamic';

export default async function ProjectsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [projectsRes, areasRes, tasksRes] = await Promise.all([
    supabase
      .from('projects')
      .select('*')
      .eq('user_id', user.id)
      .neq('status', 'archived')
      .order('created_at', { ascending: false }),
    supabase.from('areas').select('id, name').eq('user_id', user.id).order('sort_order'),
    supabase
      .from('tasks')
      .select('id, project_id, status, title')
      .eq('user_id', user.id)
      .neq('status', 'cancelled'),
  ]);

  return (
    <ProjectsView
      projects={projectsRes.data ?? []}
      areas={areasRes.data ?? []}
      tasks={tasksRes.data ?? []}
    />
  );
}
