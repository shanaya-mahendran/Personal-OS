'use server';

/**
 * AI Assistant actions (spec §15).
 *
 * AI proposes, user disposes:
 *  - The /ai-assistant Edge Function returns either a plain reply or a
 *    PROPOSAL (tool name + args). Nothing is written at that point.
 *  - Read-only tools may run automatically (they cannot mutate anything).
 *  - Mutating tools render a preview card; only confirmProposal() — called
 *    after an explicit user click — re-validates and executes them.
 *  - Every execution re-checks Zod, runs conflict detection for events, and
 *    writes an audit row with source='ai'.
 */
import { TOOL_SCHEMAS, MUTATING_TOOLS, type ToolName } from '@/lib/ai/functions';
import { executeTool, ExecutorError } from '@/lib/ai/executor';
import { detectConflicts, type OverlappingEvent } from '@/lib/calendar/conflicts';
import type { Database } from '@/lib/supabase/types';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ActionError, audit, errorMessage, revalidateApp, requireContext } from './helpers';

export interface AssistantActionResult<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}

export interface AssistantProposal {
  name: ToolName;
  args: Record<string, unknown>;
}

export interface ChatOutcome {
  reply: string;
  proposal?: AssistantProposal;
  tool_result?: unknown;
}

async function invokeAssistant(
  supabase: SupabaseClient<Database>,
  body: Record<string, unknown>,
): Promise<ChatOutcome | null> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return null;
    const res = await supabase.functions.invoke('ai-assistant', {
      body,
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (res.error) throw new ActionError(res.error.message ?? 'Assistant unavailable');
    return res.data as ChatOutcome;
  } catch (err) {
    if (err instanceof ActionError) throw err;
    throw new ActionError('Assistant is unavailable right now');
  }
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

/** Persist a chat turn (spec §15: history lives in chat_messages). */
export async function persistChatMessage(
  role: 'user' | 'assistant',
  content: string,
  toolProposal?: unknown,
): Promise<AssistantActionResult<{ id: string }>> {
  try {
    const { supabase, userId } = await requireContext();
    const { data, error } = await supabase
      .from('chat_messages')
      .insert({
        user_id: userId,
        role,
        content: content.slice(0, 20000),
        tool_proposal: (toolProposal ?? null) as never,
      })
      .select('id')
      .single();
    if (error) throw new ActionError(error.message);
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

/** Send a message; returns Gemini's reply or a proposal. */
export async function sendAssistantMessage(
  message: string,
  history: ChatMessage[] = [],
): Promise<AssistantActionResult<ChatOutcome>> {
  try {
    const text = message.trim();
    if (!text) return { ok: false, error: 'Message is empty' };
    const { supabase, userId } = await requireContext();

    const outcome = await invokeAssistant(supabase, {
      mode: 'chat',
      message: text,
      history: history.slice(-20),
      user_id: userId,
    });
    if (!outcome) throw new ActionError('Assistant unavailable');

    // Read-only tools execute immediately — they cannot mutate anything.
    if (outcome.proposal && !MUTATING_TOOLS.has(outcome.proposal.name)) {
      const executed = await executeTool(supabase, {
        userId,
        tool: outcome.proposal.name,
        args: outcome.proposal.args,
        confirm: true,
      });
      const summary = await invokeAssistant(supabase, {
        mode: 'summarize',
        message: text,
        tool_name: outcome.proposal.name,
        tool_result: executed.data ?? executed.error ?? null,
        user_id: userId,
      });
      return {
        ok: true,
        data: {
          reply: summary?.reply ?? outcome.reply,
          tool_result: executed.data,
        },
      };
    }

    return { ok: true, data: outcome };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

export type ProposalOutcome =
  | { status: 'executed'; tool: ToolName; data: unknown }
  | { status: 'conflict'; overlapping: OverlappingEvent[] };

/**
 * Execute a proposal after the user confirmed it.
 * Always re-validates args; events are conflict-checked first.
 */
export async function confirmProposal(
  proposal: AssistantProposal,
): Promise<AssistantActionResult<ProposalOutcome>> {
  try {
    const { supabase, userId } = await requireContext();
    const name = proposal.name;
    if (!MUTATING_TOOLS.has(name)) {
      throw new ActionError('Only mutating proposals need confirmation');
    }

    // `force` = user acknowledged "Keep both" in the conflict dialog.
    const force = Boolean(proposal.args.force);
    // Pre-validate so we can produce a friendly conflict preview.
    const parsed = TOOL_SCHEMAS[name].safeParse(proposal.args);
    if (!parsed.success) throw new ActionError('Proposal arguments are no longer valid');

    if (!force && (name === 'create_event' || name === 'update_event')) {
      const args = parsed.data as { start_at?: string; end_at?: string; id?: string };
      if (args.start_at && args.end_at) {
        const overlapping = await detectConflicts(supabase, userId, {
          start_at: args.start_at,
          end_at: args.end_at,
          excludeId: name === 'update_event' ? args.id : null,
        });
        if (overlapping.length > 0) {
          return { ok: true, data: { status: 'conflict', overlapping } };
        }
      }
    }

    const result = await executeTool(supabase, {
      userId,
      tool: name,
      args: proposal.args,
      confirm: true,
    });

    await audit(supabase, userId, {
      action: `ai_${name}`,
      entity_type: name.replace(/^(create|update)_/, ''),
      entity_id: (result.data as { id?: string } | undefined)?.id ?? null,
      source: 'ai',
      payload: { tool: name, args: proposal.args },
    });

    revalidateApp(['/dashboard', '/tasks', '/calendar', '/projects', '/memory', '/assistant']);
    return { ok: true, data: { status: 'executed', tool: name, data: result.data } };
  } catch (err) {
    if (err instanceof ExecutorError) return { ok: false, error: err.message };
    return { ok: false, error: errorMessage(err) };
  }
}
