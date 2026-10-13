import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { OpportunityDetail } from '@/components/career/OpportunityDetail';

export const dynamic = 'force-dynamic';

export default async function OpportunityPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [{ data: opportunity }, { data: interviews }, { data: applications }] = await Promise.all([
    supabase
      .from('career_opportunities')
      .select('*')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .maybeSingle(),
    supabase
      .from('interviews')
      .select('*')
      .eq('user_id', user.id)
      .eq('opportunity_id', params.id)
      .order('scheduled_at', { ascending: true }),
    supabase
      .from('career_applications')
      .select('*')
      .eq('user_id', user.id)
      .eq('opportunity_id', params.id),
  ]);

  if (!opportunity) notFound();

  return (
    <OpportunityDetail
      opportunity={opportunity}
      interviews={interviews ?? []}
      applications={applications ?? []}
    />
  );
}
