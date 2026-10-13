/**
 * Context engine (spec §7).
 *
 * Pure, deterministic evaluation over signals. Rules, in priority order:
 * 1. Ongoing event + location match      → high confidence (0.9+)
 * 2. Ongoing event, no location signal   → medium (0.6), labeled "scheduled"
 * 3. Geofence match for a known place    → boost related context
 * 4. Sleep hours (23:00–05:30 local)     → SLEEPING (low weight)
 * 5. Otherwise                           → UNKNOWN (explicitly, never guessed)
 *
 * No continuous coordinates leave this function; only the state name does.
 */
import { hintToState, type ContextResult, type ContextState } from './states';
import { isOngoing } from '@/lib/utils/dates';
import { matchPlace, type ContextSignals } from './signals';

const SLEEP_START_MIN = 23 * 60; // 23:00
const SLEEP_END_MIN = 5 * 60 + 30; // 05:30

function localMinutes(now: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone,
  }).formatToParts(now);
  const h = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
  const m = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
  return h * 60 + m;
}

function result(
  context: ContextState,
  confidence: number,
  extras: Partial<ContextResult> = {},
): ContextResult {
  return {
    context,
    confidence: Math.round(confidence * 100) / 100,
    location_match: false,
    time_match: false,
    source: 'none',
    label: context,
    ...extras,
  };
}

export function evaluateContext(signals: ContextSignals): ContextResult {
  const { time, events, places, geolocation } = signals;
  const now = time.now;

  const ongoing = events.filter((e) => isOngoing(e.start_at, e.end_at, now));
  const place = matchPlace(places, geolocation);
  const placeState = place ? hintToState(place.context_hint ?? place.name) : null;

  // Rule 1: ongoing event with a geofence match → high confidence.
  if (ongoing.length > 0) {
    const ev = ongoing[0]!;
    const evState = hintToState(ev.title) ?? (place ? 'OUTSIDE' : null);
    if (place && evState) {
      return result(evState, 0.92, {
        event_id: ev.id,
        location_match: true,
        time_match: true,
        source: 'event',
        label: 'scheduled',
      });
    }
    // Rule 2: ongoing but no location signal → medium confidence, "scheduled".
    if (evState) {
      return result(evState, 0.6, {
        event_id: ev.id,
        location_match: false,
        time_match: true,
        source: 'event',
        label: 'scheduled',
      });
    }
    // Ongoing event whose title maps to nothing → OUTSIDE with time match.
    return result('OUTSIDE', 0.6, {
      event_id: ev.id,
      location_match: false,
      time_match: true,
      source: 'event',
      label: 'scheduled',
    });
  }

  // Rule 3: geofence match without an ongoing event.
  if (place && placeState) {
    return result(placeState, 0.85, {
      location_match: true,
      time_match: false,
      source: 'place',
      label: place.name,
    });
  }

  // Rule 4: sleep window (time-only, explicitly low confidence).
  const mins = localMinutes(now, time.timezone);
  if (mins >= SLEEP_START_MIN || mins < SLEEP_END_MIN) {
    return result('SLEEPING', 0.5, { time_match: true, source: 'time' });
  }

  // Rule 5: nothing matches → UNKNOWN, said out loud in the UI.
  return result('UNKNOWN', 0, { source: 'none' });
}

/** Default dashboard layout for a context (spec §8). */
export type DashboardLayout =
  | 'daily'
  | 'focus'
  | 'karate'
  | 'entertainment'
  | 'outside';

export function layoutFor(context: ContextState): DashboardLayout {
  switch (context) {
    case 'UNIVERSITY':
    case 'WORKSHOP':
    case 'STUDYING':
      return 'focus';
    case 'KARATE':
      return 'karate';
    case 'ENTERTAINMENT':
      return 'entertainment';
    case 'OUTSIDE':
    case 'TRAVELING':
      return 'outside';
    default:
      return 'daily';
  }
}
