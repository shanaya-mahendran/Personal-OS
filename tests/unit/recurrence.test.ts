import { describe, expect, it } from 'vitest';
import { expandRRule, parseRRule } from '@/lib/calendar/recurrence';

describe('parseRRule', () => {
  it('parses frequency and interval', () => {
    const parsed = parseRRule('RRULE:FREQ=WEEKLY;INTERVAL=2');
    expect(parsed).not.toBeNull();
    expect(parsed!.FREQ).toBe('WEEKLY');
    expect(parsed!.INTERVAL).toBe(2);
  });

  it('parses BYDAY, COUNT, UNTIL', () => {
    const parsed = parseRRule('RRULE:FREQ=WEEKLY;BYDAY=MO,WE;COUNT=6;UNTIL=20260601T000000Z');
    expect(parsed!.BYDAY).toEqual(['MO', 'WE']);
    expect(parsed!.COUNT).toBe(6);
    expect(parsed!.UNTIL).toBe('20260601T000000Z');
  });

  it('rejects unsupported frequencies', () => {
    expect(parseRRule('RRULE:FREQ=SECONDLY')).toBeNull();
    expect(parseRRule('nonsense')).toBeNull();
  });
});

describe('expandRRule', () => {
  const now = new Date('2026-05-01T00:00:00Z');

  it('expands daily rules', () => {
    const start = new Date('2026-05-01T09:00:00Z');
    const dates = expandRRule('RRULE:FREQ=DAILY;COUNT=3', start, 10, now);
    expect(dates).toHaveLength(3);
    expect(dates[0]!.toISOString()).toBe('2026-05-01T09:00:00.000Z');
    expect(dates[2]!.toISOString()).toBe('2026-05-03T09:00:00.000Z');
  });

  it('expands weekly rules by interval', () => {
    const start = new Date('2026-05-01T09:00:00Z'); // Friday
    const dates = expandRRule('RRULE:FREQ=WEEKLY;COUNT=3', start, 10, now);
    expect(dates).toHaveLength(3);
    expect(dates[1]!.getTime() - dates[0]!.getTime()).toBe(7 * 86_400_000);
  });

  it('respects BYDAY', () => {
    const start = new Date('2026-05-01T09:00:00Z');
    const dates = expandRRule('RRULE:FREQ=WEEKLY;BYDAY=MO;COUNT=2', start, 10, now);
    expect(dates).toHaveLength(2);
    // 2026-05-04 is a Monday
    expect(dates[0]!.toISOString().slice(0, 10)).toBe('2026-05-04');
    expect(dates[1]!.toISOString().slice(0, 10)).toBe('2026-05-11');
  });

  it('stops at UNTIL', () => {
    const start = new Date('2026-05-01T09:00:00Z');
    const dates = expandRRule(
      'RRULE:FREQ=DAILY;UNTIL=20260503T235959Z',
      start,
      30,
      now,
    );
    expect(dates.length).toBeLessThanOrEqual(3);
    expect(dates.at(-1)!.getTime()).toBeLessThanOrEqual(new Date('2026-05-03T23:59:59Z').getTime());
  });

  it('expands monthly rules', () => {
    const start = new Date('2026-01-15T09:00:00Z');
    const dates = expandRRule('RRULE:FREQ=MONTHLY;COUNT=3', start, 10, new Date('2026-01-01T00:00:00Z'));
    expect(dates).toHaveLength(3);
    expect(dates[1]!.getUTCMonth()).toBe(1);
    expect(dates[2]!.getUTCMonth()).toBe(2);
  });
});
