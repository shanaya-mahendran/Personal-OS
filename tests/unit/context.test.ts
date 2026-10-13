import { describe, expect, it } from 'vitest';
import { evaluateContext, layoutFor } from '@/lib/context/engine';
import { hintToState } from '@/lib/context/states';
import { distanceMeters, matchPlace, type ContextSignals } from '@/lib/context/signals';

const TZ = 'Asia/Colombo';

function signals(overrides: Partial<ContextSignals> = {}): ContextSignals {
  return {
    time: { now: new Date('2026-05-04T10:00:00Z'), timezone: TZ },
    events: [],
    tasks: [],
    places: [],
    geolocation: null,
    music: null,
    ...overrides,
  };
}

describe('hintToState', () => {
  it('maps titles to states', () => {
    expect(hintToState('Data Structures Lecture')).toBe('UNIVERSITY');
    expect(hintToState('Robotics workshop')).toBe('WORKSHOP');
    expect(hintToState('Karate training')).toBe('KARATE');
    expect(hintToState('Random thing')).toBeNull();
    expect(hintToState(null)).toBeNull();
  });
});

describe('distanceMeters', () => {
  it('is zero at the same point', () => {
    expect(distanceMeters({ lat: 6.9147, lon: 79.962 }, { lat: 6.9147, lon: 79.962 })).toBe(0);
  });

  it('is roughly correct over ~1km', () => {
    // ~0.009 degrees latitude ≈ 1km
    const d = distanceMeters({ lat: 6.9147, lon: 79.962 }, { lat: 6.9237, lon: 79.962 });
    expect(d).toBeGreaterThan(900);
    expect(d).toBeLessThan(1100);
  });
});

describe('matchPlace', () => {
  const place = {
    id: 'p1',
    name: 'University of Moratuwa',
    latitude: 6.9147,
    longitude: 79.962,
    radius_m: 200,
    context_hint: 'UNIVERSITY',
  };

  it('matches within the radius', () => {
    expect(
      matchPlace([place], { latitude: 6.915, longitude: 79.962 }),
    ).not.toBeNull();
  });

  it('misses outside the radius', () => {
    expect(
      matchPlace([place], { latitude: 6.95, longitude: 79.962 }),
    ).toBeNull();
  });

  it('returns null without geolocation', () => {
    expect(matchPlace([place], null)).toBeNull();
  });
});

describe('evaluateContext', () => {
  const place = {
    id: 'p1',
    name: 'University of Moratuwa',
    latitude: 6.9147,
    longitude: 79.962,
    radius_m: 300,
    context_hint: 'UNIVERSITY',
  };

  it('rule 1: ongoing event + geofence match → high confidence', () => {
    const result = evaluateContext(
      signals({
        events: [
          {
            id: 'e1',
            title: 'Lecture',
            start_at: '2026-05-04T09:30:00Z',
            end_at: '2026-05-04T11:30:00Z',
            location: 'University of Moratuwa',
          },
        ],
        places: [place],
        geolocation: { latitude: 6.9147, longitude: 79.962 },
      }),
    );
    expect(result.context).toBe('UNIVERSITY');
    expect(result.confidence).toBeGreaterThanOrEqual(0.9);
    expect(result.location_match).toBe(true);
    expect(result.event_id).toBe('e1');
  });

  it('rule 2: ongoing event, no location signal → medium confidence, scheduled', () => {
    const result = evaluateContext(
      signals({
        events: [
          {
            id: 'e2',
            title: 'Robotics workshop',
            start_at: '2026-05-04T09:30:00Z',
            end_at: '2026-05-04T11:30:00Z',
            location: null,
          },
        ],
        time: { now: new Date('2026-05-04T10:00:00Z'), timezone: TZ },
      }),
    );
    expect(result.context).toBe('WORKSHOP');
    expect(result.confidence).toBe(0.6);
    expect(result.label).toBe('scheduled');
    expect(result.location_match).toBe(false);
  });

  it('rule 3: geofence match without an event → boosted context', () => {
    const result = evaluateContext(
      signals({
        places: [place],
        geolocation: { latitude: 6.9147, longitude: 79.962 },
        time: { now: new Date('2026-05-04T06:00:00Z'), timezone: TZ }, // 11:30 local
      }),
    );
    expect(result.context).toBe('UNIVERSITY');
    expect(result.confidence).toBe(0.85);
    expect(result.location_match).toBe(true);
  });

  it('rule 4: sleep window → SLEEPING with low confidence', () => {
    const result = evaluateContext(
      signals({ time: { now: new Date('2026-05-04T19:00:00Z'), timezone: TZ } }), // 00:30 local
    );
    expect(result.context).toBe('SLEEPING');
    expect(result.confidence).toBeLessThanOrEqual(0.5);
  });

  it('rule 5: nothing matches → UNKNOWN, explicitly', () => {
    const result = evaluateContext(
      signals({ time: { now: new Date('2026-05-04T06:00:00Z'), timezone: TZ } }), // 11:30 local
    );
    expect(result.context).toBe('UNKNOWN');
    expect(result.confidence).toBe(0);
    expect(result.source).toBe('none');
  });
});

describe('layoutFor', () => {
  it('maps contexts to dashboard layouts', () => {
    expect(layoutFor('UNIVERSITY')).toBe('focus');
    expect(layoutFor('WORKSHOP')).toBe('focus');
    expect(layoutFor('KARATE')).toBe('karate');
    expect(layoutFor('ENTERTAINMENT')).toBe('entertainment');
    expect(layoutFor('OUTSIDE')).toBe('outside');
    expect(layoutFor('HOME')).toBe('daily');
    expect(layoutFor('UNKNOWN')).toBe('daily');
  });
});
