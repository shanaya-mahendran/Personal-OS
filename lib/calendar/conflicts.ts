/**
 * Event conflict detection (spec §10).
 *
 * The system warns; the user decides. Nothing is ever moved or deleted
 * silently — callers must surface ConflictDialog on a non-empty result.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';

export interface OverlappingEvent {
  id: string;
  title: string;
  start_at: string;
  end_at: string;
  location: string | null;
}

export interface ConflictInput {
  start_at: string;
  end_at: string;
  excludeId?: string | null;
}

/**
 * Half-open overlap test: [start, end) intervals overlap when
 * a.start < b.end AND a.end > b.start.
 */
export function intervalsOverlap(
  a: { start: string; end: string },
  b: { start: string; end: string },
): boolean {
  return new Date(a.start).getTime() < new Date(b.end).getTime()
    && new Date(a.end).getTime() > new Date(b.start).getTime();
}

/** Pure filter version — used by tests and client previews. */
export function findOverlaps<T extends { id: string; start_at: string; end_at: string }>(
  existing: T[],
  candidate: { start_at: string; end_at: string },
  excludeId?: string | null,
): T[] {
  return existing.filter(
    (e) =>
      e.id !== (excludeId ?? '') &&
      intervalsOverlap(
        { start: e.start_at, end: e.end_at },
        { start: candidate.start_at, end: candidate.end_at },
      ),
  );
}

/** Queries overlapping events for a user. Called before every insert/update. */
export async function detectConflicts(
  supabase: SupabaseClient<Database>,
  userId: string,
  { start_at, end_at, excludeId }: ConflictInput,
): Promise<OverlappingEvent[]> {
  const { data, error } = await supabase
    .from('events')
    .select('id, title, start_at, end_at, location')
    .eq('user_id', userId)
    .neq('id', excludeId ?? '')
    .neq('status', 'cancelled')
    .lt('start_at', end_at)
    .gt('end_at', start_at);

  if (error) throw new Error(`Conflict check failed: ${error.message}`);
  return (data ?? []) as OverlappingEvent[];
}

export interface ConflictDecision {
  choice: 'keep_both' | 'edit_times' | 'cancel';
}

export function describeConflict(o: OverlappingEvent): string {
  return `${o.title} (${o.start_at} – ${o.end_at})`;
}
