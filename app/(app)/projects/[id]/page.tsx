import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ProjectDetail } from '@/components/projects/ProjectDetail';

export const dynamic = 'force-dynamic';

export default async function ProjectDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [projectRes, tasksRes, areasRes] = await Promise.all([
    supabase
      .from('projects')
      .select('*')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .maybeSingle(),
    supabase
      .from('tasks')
      .select('*')
      .eq('user_id', user.id)
      .eq('project_id', params.id)
      .neq('status', 'cancelled')
      .order('created_at', { ascending: false }),
    supabase.from('areas').select('id, name').eq('user_id', user.id),
  ]);

  if (!projectRes.data) notFound();

  return (
    <ProjectDetail
      project={projectRes.data}
      tasks={tasksRes.data ?? []}
      areas={areasRes.data ?? []}
    />
  );
}
