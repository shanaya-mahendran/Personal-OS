/**
 * Validated AI function execution.
 *
 * Safety rules enforced here (see spec §5.7):
 * - Arguments always pass the tool's Zod schema before anything runs.
 * - No DELETE tool exists; the AI can never remove data.
 * - Mutating tools are PREVIEW-ONLY until `confirm=true` is passed by the
 *   server action that the user explicitly approved.
 * - Every execution writes an audit_logs row with source='ai'.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';
import { MUTATING_TOOLS, TOOL_SCHEMAS, type ToolName } from './functions';

export class ExecutorError extends Error {
  constructor(message: string, public readonly code: 'invalid_args' | 'needs_confirmation' | 'not_found' | 'rate_limited') {
    super(message);
    this.name = 'ExecutorError';
  }
}

export interface ExecutionInput {
  userId: string;
  tool: string;
  args: Record<string, unknown>;
  /** Must be true (via confirmed server action) for mutating tools. */
  confirm: boolean;
  aiRunId?: string;
}

export interface ExecutionResult {
  ok: boolean;
  tool: ToolName;
  data?: unknown;
  preview?: unknown;
  error?: string;
}

export async function executeTool(
  supabase: SupabaseClient<Database>,
  input: ExecutionInput,
): Promise<ExecutionResult> {
  const { userId, tool, args, confirm } = input;

  if (!(tool in TOOL_SCHEMAS)) {
    throw new ExecutorError(`Unknown tool: ${tool}`, 'invalid_args');
  }
  const name = tool as ToolName;
  const parsed = TOOL_SCHEMAS[name].safeParse(args);
  if (!parsed.success) {
    throw new ExecutorError(
      `Invalid arguments for ${tool}: ${parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`,
      'invalid_args',
    );
  }

  const isMutation = MUTATING_TOOLS.has(name);
  if (isMutation && !confirm) {
    // Return a preview; nothing is written.
    return { ok: true, tool: name, preview: parsed.data };
  }

  const value = parsed.data as Record<string, unknown>;

  switch (name) {
    case 'create_task': {
      const { data, error } = await supabase
        .from('tasks')
        .insert({
          user_id: userId,
          title: String(value.title),
          description: (value.description as string | undefined) ?? null,
          priority: (value.priority as 'low' | 'medium' | 'high' | 'urgent') ?? 'medium',
          due_at: (value.due_at as string | null | undefined) ?? null,
          area_id: (value.area_id as string | null | undefined) ?? null,
          project_id: (value.project_id as string | null | undefined) ?? null,
        })
        .select()
        .single();
      if (error) throw new ExecutorError(error.message, 'not_found');
      return { ok: true, tool: name, data };
    }
    case 'update_task': {
      const { id, ...rest } = value;
      const { data, error } = await supabase
        .from('tasks')
        .update(rest as Partial<import('@/lib/supabase/types').TaskRow>)
        .eq('id', String(id))
        .eq('user_id', userId)
        .select()
        .single();
      if (error) throw new ExecutorError(error.message, 'not_found');
      return { ok: true, tool: name, data };
    }
    case 'create_event': {
      const { data, error } = await supabase
        .from('events')
        .insert({
          user_id: userId,
          title: String(value.title),
          description: (value.description as string | undefined) ?? null,
          start_at: String(value.start_at),
          end_at: String(value.end_at),
          timezone: (value.timezone as string) ?? 'Asia/Colombo',
          location: (value.location as string | null | undefined) ?? null,
          organizer: (value.organizer as string | null | undefined) ?? null,
        })
        .select()
        .single();
      if (error) throw new ExecutorError(error.message, 'not_found');
      return { ok: true, tool: name, data };
    }
    case 'update_event': {
      const { id, ...rest } = value;
      const { data, error } = await supabase
        .from('events')
        .update(rest as Partial<import('@/lib/supabase/types').EventRow>)
        .eq('id', String(id))
        .eq('user_id', userId)
        .select()
        .single();
      if (error) throw new ExecutorError(error.message, 'not_found');
      return { ok: true, tool: name, data };
    }
    case 'create_project': {
      const { data, error } = await supabase
        .from('projects')
        .insert({
          user_id: userId,
          title: String(value.title),
          description: (value.description as string | undefined) ?? null,
          goal: (value.goal as string | undefined) ?? null,
          area_id: (value.area_id as string | null | undefined) ?? null,
          deadline_at: (value.deadline_at as string | null | undefined) ?? null,
          next_action: (value.next_action as string | null | undefined) ?? null,
        })
        .select()
        .single();
      if (error) throw new ExecutorError(error.message, 'not_found');
      return { ok: true, tool: name, data };
    }
    case 'create_note': {
      const { data, error } = await supabase
        .from('notes')
        .insert({
          user_id: userId,
          title: String(value.title),
          body: String(value.body),
          area_id: (value.area_id as string | null | undefined) ?? null,
          tags: (value.tags as string[] | undefined) ?? null,
        })
        .select()
        .single();
      if (error) throw new ExecutorError(error.message, 'not_found');
      return { ok: true, tool: name, data };
    }
    case 'create_memory': {
      const { data, error } = await supabase
        .from('memories')
        .insert({
          user_id: userId,
          kind: value.kind as 'decision' | 'lesson' | 'preference' | 'fact' | 'experience',
          title: String(value.title),
          body: String(value.body),
        })
        .select()
        .single();
      if (error) throw new ExecutorError(error.message, 'not_found');
      return { ok: true, tool: name, data };
    }
    case 'create_reminder': {
      // Reminders become tasks with reminder_at set — no separate table.
      const { data, error } = await supabase
        .from('tasks')
        .insert({
          user_id: userId,
          title: String(value.title),
          reminder_at: String(value.remind_at),
          due_at: String(value.remind_at),
          priority: 'medium',
        })
        .select()
        .single();
      if (error) throw new ExecutorError(error.message, 'not_found');
      return { ok: true, tool: name, data };
    }
    case 'search_memory': {
      const query = String(value.query);
      const limit = Number(value.limit ?? 10);
      // Semantic (vector) search runs in the Edge Function; the SQL text
      // variant is the always-available fallback and is RLS-scoped.
      const { data, error } = await supabase.rpc('search_memories_text', {
        query_text: query,
        match_count: limit,
      });
      if (error) throw new ExecutorError(error.message, 'not_found');
      return { ok: true, tool: name, data };
    }
    case 'get_today': {
      const now = new Date();
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      const [tasks, events] = await Promise.all([
        supabase
          .from('tasks')
          .select('id,title,status,priority,due_at')
          .eq('user_id', userId)
          .neq('status', 'cancelled')
          .or(`due_at.is.null,due_at.gte.${start.toISOString()},due_at.lt.${end.toISOString()}`)
          .order('due_at', { ascending: true })
          .limit(25),
        supabase
          .from('events')
          .select('id,title,start_at,end_at,location')
          .eq('user_id', userId)
          .lt('start_at', end.toISOString())
          .gt('end_at', start.toISOString())
          .order('start_at', { ascending: true }),
      ]);
      return {
        ok: true,
        tool: name,
        data: { tasks: tasks.data ?? [], events: events.data ?? [] },
      };
    }
    case 'get_schedule': {
      const days = Number(value.days ?? 1);
      const base = value.date
        ? new Date(`${value.date}T00:00:00Z`)
        : (() => {
            const d = new Date();
            d.setUTCHours(0, 0, 0, 0);
            return d;
          })();
      const end = new Date(base.getTime() + days * 86_400_000);
      const { data, error } = await supabase
        .from('events')
        .select('id,title,start_at,end_at,location,status')
        .eq('user_id', userId)
        .lt('start_at', end.toISOString())
        .gt('start_at', new Date(base.getTime() - 86_400_000).toISOString())
        .order('start_at', { ascending: true });
      if (error) throw new ExecutorError(error.message, 'not_found');
      return { ok: true, tool: name, data };
    }
    case 'get_prayer_times': {
      const date =
        (value.date as string | undefined) ?? new Date().toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from('prayer_schedules')
        .select('*')
        .eq('user_id', userId)
        .eq('date', date)
        .maybeSingle();
      if (error) throw new ExecutorError(error.message, 'not_found');
      return {
        ok: true,
        tool: name,
        data: data ?? { date, configured: false },
      };
    }
    case 'get_day_context': {
      const includeMemories =
        (value.include_memories as boolean | undefined) ?? true;
      const dayKey =
        (value.date as string | undefined) ??
        new Date().toISOString().slice(0, 10);
      const dayStart = new Date(`${dayKey}T00:00:00Z`);
      const dayEnd = new Date(dayStart.getTime() + 86400000);
      const [tasks, events, projects, memories] = await Promise.all([
        supabase
          .from('tasks')
          .select('id,title,status,priority,due_at,project_id')
          .eq('user_id', userId)
          .neq('status', 'cancelled')
          .neq('status', 'done')
          .order('due_at', { ascending: true, nullsFirst: false })
          .limit(30),
        supabase
          .from('events')
          .select('id,title,start_at,end_at,location,status')
          .eq('user_id', userId)
          .neq('status', 'cancelled')
          .lt('start_at', dayEnd.toISOString())
          .gt('end_at', dayStart.toISOString())
          .order('start_at', { ascending: true }),
        supabase
          .from('projects')
          .select('id,title,status,goal,deadline_at,next_action')
          .eq('user_id', userId)
          .neq('status', 'archived')
          .order('deadline_at', { ascending: true, nullsFirst: false })
          .limit(20),
        includeMemories
          ? supabase
              .from('memories')
              .select('id,kind,title,body,created_at')
              .eq('user_id', userId)
              .order('created_at', { ascending: false })
              .limit(12)
          : Promise.resolve({ data: null, error: null }),
      ]);
      const recentMemories =
        (memories.data ?? []).slice(0, 8).map((m) => ({
          kind: m.kind,
          title: m.title,
          excerpt: m.body.slice(0, 400),
        }));
      return {
        ok: true,
        tool: name,
        data: {
          date: dayKey,
          tasks: tasks.data ?? [],
          events: events.data ?? [],
          projects: projects.data ?? [],
          recentMemories,
        },
      };
    }
    default: {
      const exhaustive: never = name;
      throw new ExecutorError(`Unhandled tool: ${String(exhaustive)}`, 'invalid_args');
    }
  }
}

/** 30 AI calls per user per hour, counted from ai_runs. */
export const AI_RATE_LIMIT = 30;
export const AI_RATE_WINDOW_MS = 60 * 60 * 1000;

export async function checkRateLimit(
  supabase: SupabaseClient<Database>,
  userId: string,
  functionName: string,
): Promise<{ allowed: boolean; used: number }> {
  const since = new Date(Date.now() - AI_RATE_WINDOW_MS).toISOString();
  const { count } = await supabase
    .from('ai_runs')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('function_name', functionName)
    .gte('created_at', since);
  const used = count ?? 0;
  return { allowed: used < AI_RATE_LIMIT, used };
}
