'use server';

/**
 * Life-module actions: career, volunteering, karate, eating, entertainment,
 * notes, water. Each is re-validated with Zod and audited.
 */
import { z } from 'zod';
import {
  EntertainmentLogCreateSchema,
  InterviewCreateSchema,
  KarateSessionCreateSchema,
  MealCreateSchema,
  NoteCreateSchema,
  OpportunityCreateSchema,
  VolunteeringCreateSchema,
} from '@/lib/validation/career';
import { detectConflicts, type OverlappingEvent } from '@/lib/calendar/conflicts';
import {
  ActionError,
  audit,
  errorMessage,
  revalidateApp,
  requireContext,
} from './helpers';

export interface ModuleResult<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}

async function insertAndAudit<T extends { id: string }>(
  table:
    | 'career_opportunities'
    | 'volunteering'
    | 'karate_sessions'
    | 'meals'
    | 'entertainment_logs'
    | 'notes'
    | 'karate_goals'
    | 'family_events'
    | 'branding_content',
  input: unknown,
  schema: z.ZodTypeAny,
  paths: string[],
): Promise<ModuleResult<T>> {
  try {
    const parsed = schema.parse(input);
    const { supabase, userId } = await requireContext();
    const { data, error } = await supabase
      .from(table)
      .insert({ ...(parsed as object), user_id: userId } as never)
      .select()
      .single();
    if (error) throw new ActionError(error.message);
    await audit(supabase, userId, {
      action: 'create',
      entity_type: table,
      entity_id: data.id,
    });
    revalidateApp(paths);
    return { ok: true, data: data as unknown as T };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

export const createOpportunity = (input: unknown) =>
  insertAndAudit('career_opportunities', input, OpportunityCreateSchema, ['/career', '/dashboard']);

export const createVolunteering = (input: unknown) =>
  insertAndAudit('volunteering', input, VolunteeringCreateSchema, ['/volunteering']);

export const createKarateSession = (input: unknown) =>
  insertAndAudit('karate_sessions', input, KarateSessionCreateSchema, ['/karate', '/dashboard']);

export const createKarateGoal = (input: unknown) =>
  insertAndAudit(
    'karate_goals',
    input,
    z.object({
      title: z.string().min(1).max(300),
      target_date: z.string().date().nullable().optional(),
      progress: z.number().min(0).max(100).default(0),
      notes: z.string().max(5000).nullable().optional(),
    }),
    ['/karate'],
  );

export const createMeal = (input: unknown) =>
  insertAndAudit('meals', input, MealCreateSchema, ['/eating', '/dashboard']);

export const createEntertainmentLog = (input: unknown) =>
  insertAndAudit('entertainment_logs', input, EntertainmentLogCreateSchema, [
    '/entertainment',
    '/dashboard',
  ]);

export const createNote = (input: unknown) =>
  insertAndAudit('notes', input, NoteCreateSchema, ['/inbox', '/dashboard']);

export const createFamilyEvent = (input: unknown) =>
  insertAndAudit(
    'family_events',
    input,
    z.object({
      title: z.string().trim().min(1).max(300),
      kind: z.enum(['gathering', 'visit', 'task', 'celebration', 'other']).default('other'),
      event_date: z.string().date().nullable().optional(),
      notes: z.string().max(5000).nullable().optional(),
    }),
    ['/family'],
  );

export const createBrandingContent = (input: unknown) =>
  insertAndAudit(
    'branding_content',
    input,
    z.object({
      platform: z.enum(['linkedin', 'github', 'portfolio']),
      title: z.string().trim().min(1).max(300),
      status: z.enum(['idea', 'draft', 'ready', 'published', 'archived']).default('idea'),
      url: z.string().url().nullable().or(z.literal('').transform(() => null)),
      notes: z.string().max(5000).nullable().optional(),
    }),
    ['/branding'],
  );

export const updateBrandingStatus = async (
  id: string,
  status: 'idea' | 'draft' | 'ready' | 'published' | 'archived',
): Promise<ModuleResult> => {
  try {
    const { supabase, userId } = await requireContext();
    const { error } = await supabase
      .from('branding_content')
      .update({
        status,
        ...(status === 'published' ? { published_at: new Date().toISOString() } : {}),
      })
      .eq('id', id)
      .eq('user_id', userId);
    if (error) throw new ActionError(error.message);
    await audit(supabase, userId, {
      action: 'status_change',
      entity_type: 'branding_content',
      entity_id: id,
      payload: { status },
    });
    revalidateApp(['/branding']);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
};

/** Move a career opportunity through the pipeline. */
export async function updateOpportunityStatus(
  id: string,
  status: z.infer<typeof OpportunityCreateSchema>['status'],
): Promise<ModuleResult> {
  try {
    const { supabase, userId } = await requireContext();
    const { data, error } = await supabase
      .from('career_opportunities')
      .update({ status })
      .eq('id', id)
      .eq('user_id', userId)
      .select('id')
      .single();
    if (error) throw new ActionError(error.message);
    await audit(supabase, userId, {
      action: 'status_change',
      entity_type: 'career_opportunity',
      entity_id: id,
      payload: { status },
    });
    revalidateApp(['/career']);
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

export type InterviewOutcome =
  | { status: 'created'; interview: unknown }
  | { status: 'conflict'; overlapping: OverlappingEvent[] };

/** Interviews auto-create a calendar event — conflict-checked first. */
export async function createInterview(input: unknown): Promise<ModuleResult<InterviewOutcome>> {
  try {
    const force = Boolean((input as Record<string, unknown> | null)?.force);
    const parsed = InterviewCreateSchema.parse(input);
    const { supabase, userId } = await requireContext();

    const end = new Date(new Date(parsed.scheduled_at).getTime() + 45 * 60_000).toISOString();
    const overlapping = force
      ? []
      : await detectConflicts(supabase, userId, {
          start_at: parsed.scheduled_at,
          end_at: end,
        });
    if (overlapping.length > 0) {
      return { ok: true, data: { status: 'conflict', overlapping } };
    }

    const { data, error } = await supabase
      .from('interviews')
      .insert({ ...parsed, user_id: userId })
      .select()
      .single();
    if (error) throw new ActionError(error.message);

    const { data: opp } = await supabase
      .from('career_opportunities')
      .select('company, role')
      .eq('id', parsed.opportunity_id)
      .single();

    const { data: profileTz } = await supabase
      .from('profiles')
      .select('timezone')
      .eq('id', userId)
      .maybeSingle();
    await supabase.from('events').insert({
      user_id: userId,
      title: `Interview: ${opp?.role ?? 'Role'} at ${opp?.company ?? 'Company'}`,
      description: parsed.notes ?? undefined,
      start_at: parsed.scheduled_at,
      end_at: end,
      timezone: profileTz?.timezone ?? 'Asia/Colombo',
    });

    await audit(supabase, userId, {
      action: 'create',
      entity_type: 'interview',
      entity_id: data.id,
    });
    revalidateApp(['/career', '/calendar']);
    return { ok: true, data: { status: 'created', interview: data } };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

const WaterSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  delta: z.number().int().min(-20).max(20),
});

/** Increment/decrement today's water counter (idempotent upsert). */
export async function adjustWater(input: unknown): Promise<ModuleResult<{ glasses: number }>> {
  try {
    const { date, delta } = WaterSchema.parse(input);
    const { supabase, userId } = await requireContext();

    const { data: existing } = await supabase
      .from('water_logs')
      .select('id, glasses')
      .eq('user_id', userId)
      .eq('date', date)
      .maybeSingle();

    const next = Math.max(0, Math.min(40, (existing?.glasses ?? 0) + delta));
    const { error } = existing
      ? await supabase.from('water_logs').update({ glasses: next }).eq('id', existing.id)
      : await supabase.from('water_logs').insert({ user_id: userId, date, glasses: next });
    if (error) throw new ActionError(error.message);
    return { ok: true, data: { glasses: next } };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

const DayMealToggleSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  meal_type: z.enum(['breakfast', 'lunch', 'dinner', 'snack']),
  skipped: z.boolean(),
});

/** Mark a meal as skipped/eaten for the day checklist. */
export async function toggleMeal(input: unknown): Promise<ModuleResult> {
  try {
    const { date, meal_type, skipped } = DayMealToggleSchema.parse(input);
    const { supabase, userId } = await requireContext();
    const { error } = await supabase.from('meals').upsert(
      { user_id: userId, date, meal_type, skipped, home_cooked: false, description: null },
      { onConflict: 'user_id,date,meal_type' },
    );
    if (error) throw new ActionError(error.message);
    revalidateApp(['/eating', '/dashboard']);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}
