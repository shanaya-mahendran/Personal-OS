import { describe, expect, it } from 'vitest';
import {
  calendarKey,
  dateMatchesYear,
  daysInYear,
  formatTime,
  isOngoing,
  minutesUntil,
  relativeLabel,
  timeToMinutes,
} from '@/lib/utils/dates';

describe('timeToMinutes', () => {
  it('parses HH:MM', () => {
    expect(timeToMinutes('04:48')).toBe(4 * 60 + 48);
    expect(timeToMinutes('00:00')).toBe(0);
    expect(timeToMinutes('23:59')).toBe(23 * 60 + 59);
  });

  it('parses HH:MM:SS (postgres time)', () => {
    expect(timeToMinutes('18:03:22')).toBe(18 * 60 + 3);
  });
});

describe('calendarKey', () => {
  it('returns YYYY-MM-DD in the requested timezone', () => {
    // 2026-01-01T19:00:00Z is already Jan 2 in Colombo (UTC+5:30)
    const instant = new Date('2026-01-01T19:00:00Z');
    expect(calendarKey(instant, 'Asia/Colombo')).toBe('2026-01-02');
    expect(calendarKey(instant, 'UTC')).toBe('2026-01-01');
    // 2026-01-01T02:00:00Z is still Dec 31 in New York (UTC-5)
    const instant2 = new Date('2026-01-01T02:00:00Z');
    expect(calendarKey(instant2, 'America/New_York')).toBe('2025-12-31');
  });

  it('handles midnight boundaries', () => {
    expect(calendarKey(new Date('2026-06-15T18:30:00Z'), 'Asia/Colombo')).toBe('2026-06-16');
  });
});

describe('formatTime', () => {
  it('formats 24h in timezone', () => {
    expect(formatTime('2026-03-10T10:00:00Z', 'UTC')).toBe('10:00');
    expect(formatTime('2026-03-10T10:00:00Z', 'Asia/Colombo')).toBe('15:30');
  });
});

describe('isOngoing', () => {
  const start = '2026-05-01T10:00:00Z';
  const end = '2026-05-01T11:00:00Z';

  it('is true inside the interval', () => {
    expect(isOngoing(start, end, new Date('2026-05-01T10:30:00Z'))).toBe(true);
  });

  it('is false before and after', () => {
    expect(isOngoing(start, end, new Date('2026-05-01T09:59:00Z'))).toBe(false);
    expect(isOngoing(start, end, new Date('2026-05-01T11:01:00Z'))).toBe(false);
  });
});

describe('relativeLabel', () => {
  const now = new Date('2026-05-01T10:00:00Z');

  it('formats future deltas', () => {
    expect(relativeLabel('2026-05-01T10:15:00Z', now)).toBe('15 min');
    expect(relativeLabel('2026-05-01T12:30:00Z', now)).toBe('2h 30m');
    expect(relativeLabel('2026-05-04T10:00:00Z', now)).toBe('3d');
  });

  it('formats past deltas', () => {
    expect(relativeLabel('2026-05-01T09:00:00Z', now)).toBe('1h ago');
  });

  it('handles now', () => {
    expect(relativeLabel('2026-05-01T10:00:00Z', now)).toBe('now');
  });
});

describe('minutesUntil', () => {
  it('is signed', () => {
    const now = new Date('2026-05-01T10:00:00Z');
    expect(minutesUntil('2026-05-01T10:20:00Z', now)).toBe(20);
    expect(minutesUntil('2026-05-01T09:40:00Z', now)).toBe(-20);
  });
});

describe('daysInYear / dateMatchesYear', () => {
  it('knows leap years', () => {
    expect(daysInYear(2024)).toBe(366);
    expect(daysInYear(2026)).toBe(365);
    expect(daysInYear(2000)).toBe(366);
    expect(daysInYear(1900)).toBe(365);
  });

  it('validates date-year match', () => {
    expect(dateMatchesYear('2026-02-28', 2026)).toBe(true);
    expect(dateMatchesYear('2026-02-29', 2026)).toBe(false);
    expect(dateMatchesYear('2026-13-01', 2026)).toBe(false);
    expect(dateMatchesYear('2025-06-01', 2026)).toBe(false);
    expect(dateMatchesYear('bad', 2026)).toBe(false);
  });
});
