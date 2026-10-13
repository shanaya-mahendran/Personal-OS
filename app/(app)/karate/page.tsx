import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { KarateView } from '@/components/karate/KarateView';

export const dynamic = 'force-dynamic';

export default async function KaratePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [{ data: sessions }, { data: goals }] = await Promise.all([
    supabase
      .from('karate_sessions')
      .select('*')
      .eq('user_id', user.id)
      .order('date', { ascending: false })
      .limit(120),
    supabase.from('karate_goals').select('*').eq('user_id', user.id).order('target_date'),
  ]);

  return <KarateView sessions={sessions ?? []} goals={goals ?? []} />;
}
