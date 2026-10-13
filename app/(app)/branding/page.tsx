import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { BrandingView } from '@/components/branding/BrandingView';

export const dynamic = 'force-dynamic';

/** Personal Branding: platform sub-tabs + content pipeline (spec §13). */
export default async function BrandingPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [contentRes, metricsRes] = await Promise.all([
    supabase
      .from('branding_content')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(200),
    supabase
      .from('branding_metrics')
      .select('*')
      .eq('user_id', user.id)
      .order('metric_date', { ascending: false })
      .limit(60),
  ]);

  return <BrandingView content={contentRes.data ?? []} metrics={metricsRes.data ?? []} />;
}
