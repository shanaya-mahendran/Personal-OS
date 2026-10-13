import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { TaskDetail } from '@/components/tasks/TaskDetail';

export const dynamic = 'force-dynamic';

export default async function TaskDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [{ data: task }, areasRes, projectsRes] = await Promise.all([
    supabase.from('tasks').select('*').eq('id', params.id).eq('user_id', user.id).maybeSingle(),
    supabase.from('areas').select('id, name').eq('user_id', user.id).order('sort_order'),
    supabase.from('projects').select('id, title').eq('user_id', user.id),
  ]);

  if (!task) notFound();

  return (
    <TaskDetail
      task={task}
      areas={areasRes.data ?? []}
      projects={projectsRes.data ?? []}
    />
  );
}
