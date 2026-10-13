'use server';

/**
 * Event server actions.
 *
 * Every insert/update runs conflict detection first (spec §10). On conflict
 * we RETURN the overlapping events — nothing is inserted, nothing moves.
 * The user chooses: keep both, edit times, or cancel.
 */
import { EventCreateSchema, EventUpdateSchema } from '@/lib/validation/event';
import { detectConflicts, type OverlappingEvent } from '@/lib/calendar/conflicts';
import {
  ActionError,
  audit,
  errorMessage,
  revalidateApp,
  requireContext,
} from './helpers';

export interface EventResult<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}

export type CreateEventOutcome =
  | { status: 'created'; event: unknown }
  | { status: 'conflict'; overlapping: OverlappingEvent[] };

/** Create an event, refusing silently on conflict. */
export async function createEvent(input: unknown): Promise<
  EventResult<CreateEventOutcome>
> {
  try {
    // `force` ("Keep both") is an explicit user acknowledgement.
    const force = Boolean((input as Record<string, unknown> | null)?.force);
    const parsed = EventCreateSchema.parse(input);
    const { supabase, userId } = await requireContext();

    const overlapping = force
      ? []
      : await detectConflicts(supabase, userId, {
          start_at: parsed.start_at,
          end_at: parsed.end_at,
        });
    if (overlapping.length > 0) {
      return { ok: true, data: { status: 'conflict', overlapping } };
    }

    const { data, error } = await supabase
      .from('events')
      .insert({ ...parsed, user_id: userId })
      .select()
      .single();
    if (error) throw new ActionError(error.message);

    await audit(supabase, userId, {
      action: 'create',
      entity_type: 'event',
      entity_id: data.id,
      payload: { title: data.title, start_at: data.start_at },
    });
    revalidateApp(['/dashboard', '/calendar']);
    return { ok: true, data: { status: 'created', event: data } };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

/** Update an event after conflict check against all others. */
export async function updateEvent(input: unknown): Promise<
  EventResult<CreateEventOutcome>
> {
  try {
    const force = Boolean((input as Record<string, unknown> | null)?.force);
    const { id, ...rest } = EventUpdateSchema.parse(input);
    const { supabase, userId } = await requireContext();

    // Resolve final times (fall back to the stored row when partial).
    const { data: existing, error: fetchErr } = await supabase
      .from('events')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();
    if (fetchErr || !existing) throw new ActionError('Event not found');

    const start_at = rest.start_at ?? existing.start_at;
    const end_at = rest.end_at ?? existing.end_at;
    if (new Date(end_at).getTime() <= new Date(start_at).getTime()) {
      return { ok: false, error: 'End time must be after start time' };
    }

    const overlapping = force
      ? []
      : await detectConflicts(supabase, userId, {
          start_at,
          end_at,
          excludeId: id,
        });
    if (overlapping.length > 0) {
      return { ok: true, data: { status: 'conflict', overlapping } };
    }

    const { data, error } = await supabase
      .from('events')
      .update(rest)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();
    if (error) throw new ActionError(error.message);

    await audit(supabase, userId, {
      action: 'update',
      entity_type: 'event',
      entity_id: id,
      payload: { fields: Object.keys(rest) },
    });
    revalidateApp(['/dashboard', '/calendar', `/calendar/${id}`]);
    return { ok: true, data: { status: 'created', event: data } };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

export async function deleteEvent(id: string): Promise<EventResult> {
  try {
    const { supabase, userId } = await requireContext();
    const { error } = await supabase
      .from('events')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);
    if (error) throw new ActionError(error.message);
    await audit(supabase, userId, { action: 'delete', entity_type: 'event', entity_id: id });
    revalidateApp(['/dashboard', '/calendar']);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}
