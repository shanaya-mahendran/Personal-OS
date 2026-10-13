import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { EntertainmentView } from '@/components/entertainment/EntertainmentView';
import { calendarKey, DEFAULT_TZ } from '@/lib/utils/dates';

export const dynamic = 'force-dynamic';

export default async function EntertainmentPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const today = calendarKey(new Date(), DEFAULT_TZ);
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);

  const [logsRes, musicRes] = await Promise.all([
    supabase
      .from('entertainment_logs')
      .select('*')
      .eq('user_id', user.id)
      .gte('date', weekAgo)
      .order('date', { ascending: false })
      .limit(100),
    supabase
      .from('music_sessions')
      .select('*')
      .eq('user_id', user.id)
      .is('ended_at', null)
      .maybeSingle(),
  ]);

  return (
    <EntertainmentView
      today={today}
      logs={logsRes.data ?? []}
      activeSession={musicRes.data}
    />
  );
}
