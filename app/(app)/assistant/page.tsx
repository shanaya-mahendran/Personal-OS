import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AssistantChat, type AssistantMessage } from '@/components/assistant/AssistantChat';

export const dynamic = 'force-dynamic';

/**
 * AI assistant (spec §15): chat with function-calling proposals rendered as
 * preview cards. The AI never writes to the DB — a server action does, after
 * explicit confirmation.
 */
export default async function AssistantPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: rows } = await supabase
    .from('chat_messages')
    .select('id, role, content, tool_proposal, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(50);

  const messages: AssistantMessage[] = (rows ?? []).map((r) => ({
    id: r.id,
    role: r.role,
    content: r.content,
    proposal:
      r.tool_proposal && typeof r.tool_proposal === 'object'
        ? (r.tool_proposal as unknown as AssistantMessage['proposal'])
        : undefined,
  }));

  return <AssistantChat initialMessages={messages} />;
}
