/**
 * Context engine state vocabulary (spec §7).
 * UNKNOWN is a valid state: the OS never pretends to know.
 */

export const CONTEXT_STATES = [
  'HOME',
  'UNIVERSITY',
  'WORKSHOP',
  'KARATE',
  'TRAVELING',
  'FAMILY_TIME',
  'OUTSIDE',
  'ENTERTAINMENT',
  'STUDYING',
  'SLEEPING',
  'UNKNOWN',
] as const;

export type ContextState = (typeof CONTEXT_STATES)[number];

export const CONTEXT_LABELS: Record<ContextState, string> = {
  HOME: 'Home',
  UNIVERSITY: 'University',
  WORKSHOP: 'Workshop',
  KARATE: 'Karate',
  TRAVELING: 'Traveling',
  FAMILY_TIME: 'Family time',
  OUTSIDE: 'Out',
  ENTERTAINMENT: 'Entertainment',
  STUDYING: 'Studying',
  SLEEPING: 'Sleeping',
  UNKNOWN: 'Unsure',
};

/** Map an area/event title hint to a context state. */
export function hintToState(hint: string | null | undefined): ContextState | null {
  if (!hint) return null;
  const h = hint.toLowerCase();
  if (/(university|lecture|class|campus|uom)/.test(h)) return 'UNIVERSITY';
  if (/(workshop|lab|practical|studio)/.test(h)) return 'WORKSHOP';
  if (/(karate|dojo|training|grading|kumite|kata)/.test(h)) return 'KARATE';
  if (/(study|library|exam|assignment)/.test(h)) return 'STUDYING';
  if (/(family|home|dinner)/.test(h)) return 'FAMILY_TIME';
  if (/(movie|game|anime|concert|show)/.test(h)) return 'ENTERTAINMENT';
  if (/(travel|commute|bus|train|flight)/.test(h)) return 'TRAVELING';
  if (/(sleep|bed)/.test(h)) return 'SLEEPING';
  return null;
}

export interface ContextResult {
  context: ContextState;
  confidence: number;
  event_id?: string;
  location_match: boolean;
  time_match: boolean;
  /** Human explanation shown in the chip, e.g. "scheduled" vs geofence. */
  source: 'event' | 'place' | 'time' | 'none';
  label: string;
}
