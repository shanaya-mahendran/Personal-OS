import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { EventDetail } from '@/components/calendar/EventDetail';

export const dynamic = 'force-dynamic';

export default async function EventDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: event } = await supabase
    .from('events')
    .select('*')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!event) notFound();

  return <EventDetail event={event} />;
}
