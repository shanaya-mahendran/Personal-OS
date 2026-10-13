import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { CareerBoard } from '@/components/career/CareerBoard';

export const dynamic = 'force-dynamic';

export default async function CareerPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [{ data: opportunities }, { data: areas }] = await Promise.all([
    supabase
      .from('career_opportunities')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(200),
    supabase.from('areas').select('id, name').eq('user_id', user.id),
  ]);

  return <CareerBoard opportunities={opportunities ?? []} areas={areas ?? []} />;
}
