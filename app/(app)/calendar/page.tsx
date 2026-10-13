import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { CalendarClient } from '@/components/calendar/CalendarClient';

export const dynamic = 'force-dynamic';

export default async function CalendarPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [eventsRes, profileRes] = await Promise.all([
    supabase
      .from('events')
      .select('*')
      .eq('user_id', user.id)
      .neq('status', 'cancelled')
      .gte('start_at', new Date(Date.now() - 45 * 86_400_000).toISOString())
      .lte('start_at', new Date(Date.now() + 90 * 86_400_000).toISOString())
      .order('start_at', { ascending: true }),
    supabase.from('profiles').select('timezone').eq('id', user.id).maybeSingle(),
  ]);

  return (
    <CalendarClient
      events={eventsRes.data ?? []}
      timezone={profileRes.data?.timezone ?? 'Asia/Colombo'}
    />
  );
}
