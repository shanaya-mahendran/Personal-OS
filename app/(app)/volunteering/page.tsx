import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { VolunteeringView } from '@/components/volunteering/VolunteeringView';

export const dynamic = 'force-dynamic';

export default async function VolunteeringPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: records } = await supabase
    .from('volunteering')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(200);

  return <VolunteeringView records={records ?? []} />;
}
