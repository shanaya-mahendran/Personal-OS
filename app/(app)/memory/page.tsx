import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { MemoryView } from '@/components/memory/MemoryView';

export const dynamic = 'force-dynamic';

/**
 * Personal memory (spec §14): semantic search over pgvector embeddings,
 * with text fallback and provenance (source capture) on every record.
 */
export default async function MemoryPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: memories } = await supabase
    .from('memories')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(100);

  return <MemoryView memories={memories ?? []} />;
}
