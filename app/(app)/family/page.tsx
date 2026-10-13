import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { FamilyView } from '@/components/family/FamilyView';

export const dynamic = 'force-dynamic';

/** Family: shared moments and obligations (spec §13). */
export default async function FamilyPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [{ data: records }, { data: events }] = await Promise.all([
    supabase
      .from('family_events')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100),
    supabase
      .from('events')
      .select('id, title, start_at, location')
      .eq('user_id', user.id)
      .neq('status', 'cancelled')
      .gte('start_at', new Date().toISOString())
      .order('start_at', { ascending: true })
      .limit(10),
  ]);

  return <FamilyView records={records ?? []} upcoming={events ?? []} />;
}
