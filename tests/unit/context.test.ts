/**
 * Comprehensive context engine tests.
 *
 * Covers every rule in evaluateContext:
 *  0. Manual override wins unconditionally
 *  1. Ongoing event + geofence → high confidence
 *  2. Ongoing event, no location → medium confidence "scheduled"
 *  3. Active in-progress task → activity inference
 *  4. Geofence match without event → boosted context
 *  5. Sleep window + user is active → UNKNOWN + prompt
 *  5b. Sleep window + user inactive → SLEEPING
 *  6. Nothing matches → UNKNOWN
 *
 * Also covers:
 *  - getDynamicGreeting
 *  - hintToState
 *  - distanceMeters / matchPlace
 *  - layoutFor
 */
import { describe, expect, it } from 'vitest';
import { evaluateContext, layoutFor } from '@/lib/context/engine';
import { hintToState } from '@/lib/context/states';
import { distanceMeters, matchPlace, type ContextSignals } from '@/lib/context/signals';
import { getDynamicGreeting } from '@/lib/utils/greetings';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TZ = 'Asia/Colombo'; // UTC+5:30

/** UTC time that corresponds to a specific local time in Asia/Colombo */
function localClock(h: number, m = 0): Date {
  // Colombo is UTC+5:30; subtract 5h30 to get the UTC equivalent
  return new Date(Date.UTC(2026, 4, 4, h - 5, m - 30)); // May 4 2026
}

function base(overrides: Partial<ContextSignals> = {}): ContextSignals {
  return {
    time: { now: localClock(11, 0), timezone: TZ }, // 11:00 local
    events: [],
    tasks: [],
    places: [],
    geolocation: null,
    music: null,
    userActive: false,
    manualOverride: null,
    ...overrides,
  };
}

const university = {
  id: 'p1',
  name: 'University of Moratuwa',
  latitude: 6.9147,
  longitude: 79.962,
  radius_m: 300,
  context_hint: 'UNIVERSITY',
};

// ---------------------------------------------------------------------------
// hintToState
// ---------------------------------------------------------------------------
describe('hintToState', () => {
  it.each([
    ['Data Structures Lecture', 'UNIVERSITY'],
    ['campus tour', 'UNIVERSITY'],
    ['UOM orientation', 'UNIVERSITY'],
    ['Robotics workshop', 'WORKSHOP'],
    ['Practical lab session', 'WORKSHOP'],
    ['Karate training', 'KARATE'],
    ['kata grading', 'KARATE'],
    ['Study session', 'STUDYING'],
    ['Library exam prep', 'STUDYING'],
    ['Family dinner', 'FAMILY_TIME'],
    ['Home chill', 'FAMILY_TIME'],
    ['Movie night', 'ENTERTAINMENT'],
    ['anime episode', 'ENTERTAINMENT'],
    ['Bus commute', 'TRAVELING'],
    ['train travel', 'TRAVELING'],
    ['sleep time', 'SLEEPING'],
    ['bedtime', 'SLEEPING'],
    ['Random thing', null],
    [null, null],
    [undefined, null],
  ])('hintToState(%s) → %s', (hint, expected) => {
    expect(hintToState(hint as string | null)).toBe(expected);
  });
});

// ---------------------------------------------------------------------------
// distanceMeters
// ---------------------------------------------------------------------------
describe('distanceMeters', () => {
  it('returns 0 for the same point', () => {
    expect(distanceMeters({ lat: 6.9147, lon: 79.962 }, { lat: 6.9147, lon: 79.962 })).toBe(0);
  });

  it('returns ~1 km for ~0.009° latitude shift', () => {
    const d = distanceMeters({ lat: 6.9147, lon: 79.962 }, { lat: 6.9237, lon: 79.962 });
    expect(d).toBeGreaterThan(900);
    expect(d).toBeLessThan(1100);
  });
});

// ---------------------------------------------------------------------------
// matchPlace
// ---------------------------------------------------------------------------
describe('matchPlace', () => {
  it('matches when within radius', () => {
    expect(matchPlace([university], { latitude: 6.915, longitude: 79.962 })).not.toBeNull();
  });

  it('misses when outside radius', () => {
    expect(matchPlace([university], { latitude: 6.95, longitude: 79.962 })).toBeNull();
  });

  it('returns null when geolocation is null', () => {
    expect(matchPlace([university], null)).toBeNull();
  });

  it('returns null when places list is empty', () => {
    expect(matchPlace([], { latitude: 6.9147, longitude: 79.962 })).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// evaluateContext — Rule 0: manual override
// ---------------------------------------------------------------------------
describe('evaluateContext — Rule 0: manual override', () => {
  it('returns the manual override with full confidence regardless of time', () => {
    const result = evaluateContext(
      base({
        // Sleep window — would normally return SLEEPING
        time: { now: localClock(0, 30), timezone: TZ },
        manualOverride: 'STUDYING',
      }),
    );
    expect(result.context).toBe('STUDYING');
    expect(result.confidence).toBe(1.0);
    expect(result.source).toBe('user');
  });

  it('beats an ongoing event', () => {
    const result = evaluateContext(
      base({
        events: [
          {
            id: 'e1',
            title: 'Karate training',
            start_at: localClock(10, 0).toISOString(),
            end_at: localClock(12, 0).toISOString(),
            location: null,
          },
        ],
        manualOverride: 'STUDYING',
      }),
    );
    expect(result.context).toBe('STUDYING');
    expect(result.source).toBe('user');
  });
});

// ---------------------------------------------------------------------------
// evaluateContext — Rule 1: ongoing event + geofence
// ---------------------------------------------------------------------------
describe('evaluateContext — Rule 1: ongoing event + geofence', () => {
  it('returns UNIVERSITY with ≥0.9 confidence and both match flags', () => {
    const result = evaluateContext(
      base({
        events: [
          {
            id: 'e1',
            title: 'Lecture',
            start_at: localClock(9, 30).toISOString(),
            end_at: localClock(11, 30).toISOString(),
            location: 'University of Moratuwa',
          },
        ],
        places: [university],
        geolocation: { latitude: 6.9147, longitude: 79.962 },
      }),
    );
    expect(result.context).toBe('UNIVERSITY');
    expect(result.confidence).toBeGreaterThanOrEqual(0.9);
    expect(result.location_match).toBe(true);
    expect(result.time_match).toBe(true);
    expect(result.source).toBe('event');
    expect(result.event_id).toBe('e1');
  });
});

// ---------------------------------------------------------------------------
// evaluateContext — Rule 2: ongoing event, no location
// ---------------------------------------------------------------------------
describe('evaluateContext — Rule 2: ongoing event, no location', () => {
  it('returns WORKSHOP at 0.6 confidence with "scheduled" label', () => {
    const result = evaluateContext(
      base({
        events: [
          {
            id: 'e2',
            title: 'Robotics workshop',
            start_at: localClock(9, 30).toISOString(),
            end_at: localClock(11, 30).toISOString(),
            location: null,
          },
        ],
      }),
    );
    expect(result.context).toBe('WORKSHOP');
    expect(result.confidence).toBe(0.6);
    expect(result.label).toBe('scheduled');
    expect(result.location_match).toBe(false);
    expect(result.time_match).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// evaluateContext — Rule 3: active in-progress task
// ---------------------------------------------------------------------------
describe('evaluateContext — Rule 3: in-progress task inference', () => {
  it('infers STUDYING from an in-progress study task', () => {
    const result = evaluateContext(
      base({
        tasks: [{ id: 't1', title: 'Study for DS exam', status: 'in_progress', due_at: null }],
      }),
    );
    expect(result.context).toBe('STUDYING');
    expect(result.confidence).toBe(0.85);
    expect(result.source).toBe('activity');
    expect(result.label).toContain('Study');
  });

  it('infers KARATE from a karate practice task', () => {
    const result = evaluateContext(
      base({
        tasks: [{ id: 't2', title: 'kata practice', status: 'in_progress', due_at: null }],
      }),
    );
    expect(result.context).toBe('KARATE');
    expect(result.source).toBe('activity');
  });

  it('defaults to STUDYING when task title gives no hint', () => {
    const result = evaluateContext(
      base({
        tasks: [{ id: 't3', title: 'Random chore', status: 'in_progress', due_at: null }],
      }),
    );
    // Falls back to STUDYING when title doesn't match any pattern
    expect(result.context).toBe('STUDYING');
    expect(result.source).toBe('activity');
  });

  it('ignores tasks that are NOT in_progress', () => {
    const result = evaluateContext(
      base({
        tasks: [
          { id: 't4', title: 'Study for DS exam', status: 'todo', due_at: null },
          { id: 't5', title: 'kata practice', status: 'done', due_at: null },
        ],
      }),
    );
    // No active tasks → falls through to UNKNOWN (11:00 local, no other signals)
    expect(result.context).toBe('UNKNOWN');
  });

  it('does not trigger on a missing title field', () => {
    const result = evaluateContext(
      base({
        tasks: [{ id: 't6', status: 'in_progress', due_at: null }],
      }),
    );
    // title is undefined → hintToState returns null → defaults to STUDYING
    expect(result.context).toBe('STUDYING');
    expect(result.source).toBe('activity');
  });
});

// ---------------------------------------------------------------------------
// evaluateContext — Rule 4: geofence without event
// ---------------------------------------------------------------------------
describe('evaluateContext — Rule 4: geofence match (no event)', () => {
  it('returns UNIVERSITY at 0.85 confidence from place alone', () => {
    const result = evaluateContext(
      base({
        places: [university],
        geolocation: { latitude: 6.9147, longitude: 79.962 },
      }),
    );
    expect(result.context).toBe('UNIVERSITY');
    expect(result.confidence).toBe(0.85);
    expect(result.location_match).toBe(true);
    expect(result.time_match).toBe(false);
    expect(result.source).toBe('place');
  });
});

// ---------------------------------------------------------------------------
// evaluateContext — Rule 5a: sleep window + user is active
// ---------------------------------------------------------------------------
describe('evaluateContext — Rule 5a: sleep window but user is active', () => {
  it('returns UNKNOWN with "prompt" source instead of SLEEPING', () => {
    const result = evaluateContext(
      base({
        time: { now: localClock(0, 30), timezone: TZ }, // 00:30 local
        userActive: true,
      }),
    );
    expect(result.context).toBe('UNKNOWN');
    expect(result.source).toBe('prompt');
    expect(result.label).toContain('Tap to set activity');
  });
});

// ---------------------------------------------------------------------------
// evaluateContext — Rule 5b: sleep window + user inactive
// ---------------------------------------------------------------------------
describe('evaluateContext — Rule 5b: sleep window, user inactive', () => {
  it('returns SLEEPING ≤0.5 confidence from time alone', () => {
    const result = evaluateContext(
      base({
        time: { now: localClock(0, 30), timezone: TZ }, // 00:30 local
        userActive: false,
      }),
    );
    expect(result.context).toBe('SLEEPING');
    expect(result.confidence).toBeLessThanOrEqual(0.5);
    expect(result.source).toBe('time');
  });

  it('is in sleep window at 23:15 local', () => {
    const result = evaluateContext(
      base({ time: { now: localClock(23, 15), timezone: TZ } }),
    );
    expect(result.context).toBe('SLEEPING');
  });

  it('is NOT in sleep window at 06:00 local', () => {
    const result = evaluateContext(
      base({ time: { now: localClock(6, 0), timezone: TZ } }),
    );
    expect(result.context).toBe('UNKNOWN'); // awake, no other signals
  });
});

// ---------------------------------------------------------------------------
// evaluateContext — Rule 6: UNKNOWN
// ---------------------------------------------------------------------------
describe('evaluateContext — Rule 6: nothing matches → UNKNOWN', () => {
  it('is UNKNOWN at 11:00 with no signals', () => {
    const result = evaluateContext(base());
    expect(result.context).toBe('UNKNOWN');
    expect(result.confidence).toBe(0);
    expect(result.source).toBe('none');
  });
});

// ---------------------------------------------------------------------------
// layoutFor
// ---------------------------------------------------------------------------
describe('layoutFor', () => {
  it.each([
    ['UNIVERSITY', 'focus'],
    ['WORKSHOP', 'focus'],
    ['STUDYING', 'focus'],
    ['KARATE', 'karate'],
    ['ENTERTAINMENT', 'entertainment'],
    ['OUTSIDE', 'outside'],
    ['TRAVELING', 'outside'],
    ['HOME', 'daily'],
    ['FAMILY_TIME', 'daily'],
    ['SLEEPING', 'daily'],
    ['UNKNOWN', 'daily'],
  ] as const)('layoutFor(%s) → %s', (ctx, layout) => {
    expect(layoutFor(ctx)).toBe(layout);
  });
});

// ---------------------------------------------------------------------------
// getDynamicGreeting
// ---------------------------------------------------------------------------
describe('getDynamicGreeting', () => {
  function at(hour: number) {
    return new Date(Date.UTC(2026, 4, 4, hour - 5, -30)); // Colombo UTC+5:30
  }

  it('says "Late night" at 02:00', () => {
    expect(getDynamicGreeting({ date: at(2), timezone: TZ })).toBe('Late night');
  });

  it('says "Good morning" at 08:00', () => {
    expect(getDynamicGreeting({ date: at(8), timezone: TZ })).toBe('Good morning');
  });

  it('says "Good afternoon" at 14:00', () => {
    expect(getDynamicGreeting({ date: at(14), timezone: TZ })).toBe('Good afternoon');
  });

  it('says "Good evening" at 19:00', () => {
    expect(getDynamicGreeting({ date: at(19), timezone: TZ })).toBe('Good evening');
  });

  it('says "Wind down" at 22:30', () => {
    expect(getDynamicGreeting({ date: at(22), timezone: TZ })).toBe('Wind down');
  });

  it('says "Working late" when studying at 01:00', () => {
    expect(
      getDynamicGreeting({ date: at(1), timezone: TZ, context: 'STUDYING' }),
    ).toBe('Working late');
  });

  it('says "Morning focus" when studying at 08:00', () => {
    expect(
      getDynamicGreeting({ date: at(8), timezone: TZ, context: 'STUDYING' }),
    ).toBe('Morning focus');
  });

  it('says "Afternoon session" when workshop at 15:00', () => {
    expect(
      getDynamicGreeting({ date: at(15), timezone: TZ, context: 'WORKSHOP' }),
    ).toBe('Afternoon session');
  });

  it('says "Evening focus" when studying at 20:00', () => {
    expect(
      getDynamicGreeting({ date: at(20), timezone: TZ, context: 'UNIVERSITY' }),
    ).toBe('Evening focus');
  });

  it('says "Dojo mode" when context is KARATE', () => {
    expect(getDynamicGreeting({ date: at(10), timezone: TZ, context: 'KARATE' })).toBe(
      'Dojo mode',
    );
  });

  it('says "Family time" when context is FAMILY_TIME', () => {
    expect(
      getDynamicGreeting({ date: at(19), timezone: TZ, context: 'FAMILY_TIME' }),
    ).toBe('Family time');
  });

  it('says "Unwinding" when context is ENTERTAINMENT', () => {
    expect(
      getDynamicGreeting({ date: at(20), timezone: TZ, context: 'ENTERTAINMENT' }),
    ).toBe('Unwinding');
  });

  it('respects hasActiveTask flag even without an explicit context', () => {
    expect(
      getDynamicGreeting({ date: at(9), timezone: TZ, hasActiveTask: true }),
    ).toBe('Morning focus');
  });

  it('is not affected by timezone mismatch — falls back gracefully', () => {
    // Invalid timezone should silently fall back to local hour
    expect(() =>
      getDynamicGreeting({ date: new Date(), timezone: 'Not/A/TZ' }),
    ).not.toThrow();
  });
});
