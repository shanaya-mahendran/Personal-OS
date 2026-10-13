import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { InboxView } from '@/components/capture/InboxView';

export const dynamic = 'force-dynamic';

/**
 * Universal Capture inbox (spec §6): every capture with its processing
 * state. Raw text and attachments are never deleted — provenance is sacred.
 */
export default async function InboxPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: captures } = await supabase
    .from('captures')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50);

  return <InboxView captures={captures ?? []} />;
}
