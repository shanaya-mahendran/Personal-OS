'use server';

/**
 * The Architect — server actions.
 *
 * Manages growth plans, reflection sessions, habit tracking entries, and
 * the AI-generated coaching insights that power the 15-day Pulse Checks.
 */
import { z } from 'zod';
import { generateContent } from '@/lib/gemini/client';
import type { GrowthPlanRow, ReflectionRow, HabitTrackerEntryRow, GrowthPhase } from '@/lib/supabase/types';
import {
  ActionError,
  audit,
  errorMessage,
  revalidateApp,
  requireContext,
} from './helpers';

export interface ArchitectResult<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}

// ── Schemas ───────────────────────────────────────────────────────────────────

const GrowthPlanCreateSchema = z.object({
  title: z.string().trim().min(1).max(200).default('3-Month Growth Plan'),
  started_at: z.string().date().optional(),
  goals: z
    .array(
      z.object({
        title: z.string().min(1).max(300),
        phase: z.enum(['cut_excess', 'build_foundation', 'broaden_horizons']),
        done: z.boolean().default(false),
      }),
    )
    .max(30)
    .default([]),
});

const ReflectionCreateSchema = z.object({
  plan_id: z.string().uuid().nullable().optional(),
  kind: z.enum(['quarterly_mirror', 'pulse_check_15d']),
  answers: z.record(z.string()),
});

const HabitEntrySchema = z.object({
  plan_id: z.string().uuid().nullable().optional(),
  habit_name: z.string().trim().min(1).max(200),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  completed: z.boolean().default(false),
  notes: z.string().max(1000).nullable().optional(),
});

const PhaseUpdateSchema = z.object({
  id: z.string().uuid(),
  current_phase: z.enum(['cut_excess', 'build_foundation', 'broaden_horizons']),
});

const GoalToggleSchema = z.object({
  plan_id: z.string().uuid(),
  goal_index: z.number().int().min(0),
  done: z.boolean(),
});

// ── Plan Management ───────────────────────────────────────────────────────────

/** Create a fresh 3-month growth plan. */
export async function createGrowthPlan(
  input: unknown,
): Promise<ArchitectResult<GrowthPlanRow>> {
  try {
    const parsed = GrowthPlanCreateSchema.parse(input);
    const { supabase, userId } = await requireContext();

    // Deactivate any current active plan first.
    await supabase
      .from('growth_plans')
      .update({ is_active: false })
      .eq('user_id', userId)
      .eq('is_active', true);

    const startDate = parsed.started_at ?? new Date().toISOString().slice(0, 10);
    const endDate = new Date(
      new Date(startDate).getTime() + 90 * 24 * 60 * 60 * 1000,
    )
      .toISOString()
      .slice(0, 10);

    const { data, error } = await supabase
      .from('growth_plans')
      .insert({
        user_id: userId,
        title: parsed.title,
        started_at: startDate,
        ends_at: endDate,
        goals: parsed.goals as never,
        is_active: true,
      })
      .select()
      .single();
    if (error) throw new ActionError(error.message);

    await audit(supabase, userId, {
      action: 'create',
      entity_type: 'growth_plan',
      entity_id: data.id,
      payload: { title: data.title },
    });
    revalidateApp(['/architect']);
    return { ok: true, data: data as GrowthPlanRow };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

/** Advance to the next phase of a growth plan. */
export async function updatePlanPhase(
  input: unknown,
): Promise<ArchitectResult> {
  try {
    const { id, current_phase } = PhaseUpdateSchema.parse(input);
    const { supabase, userId } = await requireContext();
    const { error } = await supabase
      .from('growth_plans')
      .update({ current_phase })
      .eq('id', id)
      .eq('user_id', userId);
    if (error) throw new ActionError(error.message);
    await audit(supabase, userId, {
      action: 'update',
      entity_type: 'growth_plan',
      entity_id: id,
      payload: { current_phase },
    });
    revalidateApp(['/architect']);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

/** Toggle a goal's completion status (stored in the goals JSONB array). */
export async function togglePlanGoal(input: unknown): Promise<ArchitectResult> {
  try {
    const { plan_id, goal_index, done } = GoalToggleSchema.parse(input);
    const { supabase, userId } = await requireContext();

    const { data: plan, error: fetchErr } = await supabase
      .from('growth_plans')
      .select('goals')
      .eq('id', plan_id)
      .eq('user_id', userId)
      .single();
    if (fetchErr || !plan) throw new ActionError('Plan not found');

    const goals = (plan.goals as Array<{ title: string; phase: GrowthPhase; done: boolean }>) ?? [];
    if (goal_index >= goals.length) throw new ActionError('Goal index out of range');
    goals[goal_index] = { title: goals[goal_index]!.title, phase: goals[goal_index]!.phase, done };

    const { error } = await supabase
      .from('growth_plans')
      .update({ goals: goals as never })
      .eq('id', plan_id)
      .eq('user_id', userId);
    if (error) throw new ActionError(error.message);

    revalidateApp(['/architect']);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

// ── Reflection / Pulse Check ──────────────────────────────────────────────────

const QUARTERLY_QUESTIONS: Record<string, string> = {
  busy_work: 'What do I do just to look busy?',
  procrastinating: 'What am I putting off that I know matters?',
  repeated_pattern: 'What patterns of behaviour do I keep repeating?',
  current_reality: 'Where am I honestly right now?',
  desired_reality: 'Where should I be in 3 months?',
  gap_reason: 'What is the real reason for that gap?',
};

const PULSE_QUESTIONS: Record<string, string> = {
  progress: 'What have I done in the last 15 days to get closer to the life I want?',
  weakness: 'Where have I shown weakness?',
  change: 'What will I change starting tomorrow?',
};

/**
 * Submit a reflection and trigger AI coaching analysis.
 * The AI cross-references answers with actual task completion data.
 */
export async function submitReflection(
  input: unknown,
): Promise<ArchitectResult<ReflectionRow>> {
  try {
    const parsed = ReflectionCreateSchema.parse(input);
    const { supabase, userId } = await requireContext();

    // Gather last-period task completion rate to ground the AI feedback.
    const sinceDays = parsed.kind === 'pulse_check_15d' ? 15 : 90;
    const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000).toISOString();

    const { data: taskStats } = await supabase
      .from('tasks')
      .select('status')
      .eq('user_id', userId)
      .gte('created_at', since);

    const total = taskStats?.length ?? 0;
    const done = taskStats?.filter((t) => t.status === 'done').length ?? 0;
    const completionRate = total > 0 ? Math.round((done / total) * 100) : null;

    // Build AI coaching prompt.
    const questionMap =
      parsed.kind === 'pulse_check_15d' ? PULSE_QUESTIONS : QUARTERLY_QUESTIONS;
    const qaText = Object.entries(parsed.answers)
      .map(([slug, answer]) => `Q: ${questionMap[slug] ?? slug}\nA: ${answer}`)
      .join('\n\n');

    let aiInsights: string | null = null;
    if (process.env.GEMINI_API_KEY && qaText) {
      try {
        const systemPrompt = `You are The Architect, a strict but supportive life coach. The user is completing a ${parsed.kind === 'pulse_check_15d' ? '15-day Pulse Check' : 'Quarterly Mirror'} session. Their task completion rate for the period was ${completionRate !== null ? `${completionRate}%` : 'unknown'}. Analyse their answers honestly and concisely. If they claim effort but data shows low completion, call it out gently. Provide 3 actionable insights (2-3 sentences each). No emojis. Be direct.`;
        const result = await generateContent({
          system: systemPrompt,
          contents: [{ role: 'user', parts: [{ text: qaText }] }],
        });
        aiInsights = result.text.trim().slice(0, 3000);
      } catch (aiErr) {
        console.warn('AI coaching insight generation failed:', aiErr);
      }
    }

    const { data, error } = await supabase
      .from('reflections')
      .insert({
        user_id: userId,
        plan_id: parsed.plan_id ?? null,
        kind: parsed.kind,
        answers: parsed.answers as never,
        ai_insights: aiInsights,
        completion_rate: completionRate,
      })
      .select()
      .single();
    if (error) throw new ActionError(error.message);

    await audit(supabase, userId, {
      action: 'create',
      entity_type: 'reflection',
      entity_id: data.id,
      payload: { kind: parsed.kind, completion_rate: completionRate },
    });
    revalidateApp(['/architect']);
    return { ok: true, data: data as ReflectionRow };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

// ── Habit Tracking ────────────────────────────────────────────────────────────

/** Upsert a daily habit entry (toggle complete/incomplete). */
export async function upsertHabitEntry(
  input: unknown,
): Promise<ArchitectResult<HabitTrackerEntryRow>> {
  try {
    const parsed = HabitEntrySchema.parse(input);
    const { supabase, userId } = await requireContext();

    const { data, error } = await supabase
      .from('habit_tracker_entries')
      .upsert(
        {
          user_id: userId,
          plan_id: parsed.plan_id ?? null,
          habit_name: parsed.habit_name,
          date: parsed.date,
          completed: parsed.completed,
          notes: parsed.notes ?? null,
        },
        { onConflict: 'user_id,habit_name,date' },
      )
      .select()
      .single();
    if (error) throw new ActionError(error.message);

    revalidateApp(['/architect']);
    return { ok: true, data: data as HabitTrackerEntryRow };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

// ── Data Fetching ─────────────────────────────────────────────────────────────

/** Fetch the current active plan + recent reflections + today's habit entries. */
export async function getArchitectData(): Promise<
  ArchitectResult<{
    plan: GrowthPlanRow | null;
    reflections: ReflectionRow[];
    habitEntries: HabitTrackerEntryRow[];
    taskCompletionToday: number;
  }>
> {
  try {
    const { supabase, userId } = await requireContext();
    const today = new Date().toISOString().slice(0, 10);

    const [planRes, reflectionsRes, habitRes, taskStatsRes] = await Promise.all([
      supabase
        .from('growth_plans')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1),
      supabase
        .from('reflections')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10),
      supabase
        .from('habit_tracker_entries')
        .select('*')
        .eq('user_id', userId)
        .eq('date', today),
      supabase
        .from('tasks')
        .select('status')
        .eq('user_id', userId)
        .gte('created_at', `${today}T00:00:00Z`)
        .lt('created_at', `${today}T23:59:59Z`),
    ]);

    const tasksToday = taskStatsRes.data ?? [];
    const doneToday = tasksToday.filter((t) => t.status === 'done').length;
    const taskCompletionToday =
      tasksToday.length > 0 ? Math.round((doneToday / tasksToday.length) * 100) : 0;

    return {
      ok: true,
      data: {
        plan: (planRes.data?.[0] as GrowthPlanRow) ?? null,
        reflections: (reflectionsRes.data ?? []) as ReflectionRow[],
        habitEntries: (habitRes.data ?? []) as HabitTrackerEntryRow[],
        taskCompletionToday,
      },
    };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}
