import { describe, expect, it } from 'vitest';
import {
  parseScheduleCsv,
  validateSchedule,
  validateTime,
  type PrayerRow,
} from '@/lib/prayer/validation';
import { currentPrayer } from '@/lib/prayer/lookup';

function fullYear(year: number): PrayerRow[] {
  const rows: PrayerRow[] = [];
  const days = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 366 : 365;
  const start = Date.UTC(year, 0, 1);
  for (let i = 0; i < days; i++) {
    const d = new Date(start + i * 86_400_000);
    rows.push({
      date: d.toISOString().slice(0, 10),
      fajr: '04:48',
      dhuhr: '12:15',
      asr: '15:37',
      maghrib: '18:03',
      isha: '19:15',
    });
  }
  return rows;
}

describe('validateTime', () => {
  it('accepts 24h HH:MM', () => {
    expect(validateTime('00:00')).toBe(true);
    expect(validateTime('04:48')).toBe(true);
    expect(validateTime('23:59')).toBe(true);
  });

  it('rejects malformed values', () => {
    expect(validateTime('24:00')).toBe(false);
    expect(validateTime('4:48')).toBe(false);
    expect(validateTime('04:60')).toBe(false);
    expect(validateTime('4.48')).toBe(false);
    expect(validateTime('')).toBe(false);
  });
});

describe('parseScheduleCsv', () => {
  it('parses a headered CSV', () => {
    const csv = [
      'date,fajr,dhuhr,asr,maghrib,isha',
      '2026-01-01,04:52,12:15,15:39,18:04,19:16',
      '2026-01-02,04:53,12:15,15:40,18:05,19:17',
    ].join('\n');
    const { rows, errors } = parseScheduleCsv(csv);
    expect(errors).toEqual([]);
    expect(rows).toHaveLength(2);
    expect(rows[0]!.date).toBe('2026-01-01');
    expect(rows[0]!.maghrib).toBe('18:04');
  });

  it('parses headerless CSV', () => {
    const csv = '2026-01-01,04:52,12:15,15:39,18:04,19:16';
    const { rows, errors } = parseScheduleCsv(csv);
    expect(errors).toEqual([]);
    expect(rows).toHaveLength(1);
  });

  it('reports bad rows', () => {
    const csv = ['date,fajr,dhuhr,asr,maghrib,isha', 'not-a-date,25:00,x,1,2,3'].join('\n');
    const { errors } = parseScheduleCsv(csv);
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe('validateSchedule', () => {
  it('accepts a complete year', () => {
    const result = validateSchedule(fullYear(2026), 2026);
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.rows).toHaveLength(365);
  });

  it('accepts a leap year', () => {
    const result = validateSchedule(fullYear(2028), 2028);
    expect(result.ok).toBe(true);
    expect(result.rows).toHaveLength(366);
  });

  it('rejects a missing day', () => {
    const rows = fullYear(2026).slice(1);
    const result = validateSchedule(rows, 2026);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('2026-01-01'))).toBe(true);
  });

  it('rejects dates from another year', () => {
    const rows = fullYear(2025);
    const result = validateSchedule(rows, 2026);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('does not fall in 2026'))).toBe(true);
  });

  it('rejects duplicate dates', () => {
    const rows = fullYear(2026);
    rows[1] = { ...rows[0]! };
    const result = validateSchedule(rows, 2026);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('Duplicate'))).toBe(true);
  });

  it('warns when prayers are out of order', () => {
    const rows = fullYear(2026);
    rows[0] = { ...rows[0]!, asr: '11:00' }; // before dhuhr
    const result = validateSchedule(rows, 2026);
    expect(result.warnings.some((w) => w.includes('asr'))).toBe(true);
  });
});

describe('currentPrayer', () => {
  const times = { fajr: '04:48', dhuhr: '12:15', asr: '15:37', maghrib: '18:03', isha: '19:15' };

  it('finds the current and next prayer', () => {
    // 13:00 Colombo = after dhuhr, before asr
    const now = new Date('2026-05-01T07:30:00Z'); // 13:00 +05:30
    const { current, next } = currentPrayer(times, now, 'Asia/Colombo');
    expect(current).toBe('dhuhr');
    expect(next).toBe('asr');
  });

  it('has no next after isha', () => {
    const now = new Date('2026-05-01T15:00:00Z'); // 20:30 +05:30
    const { current, next } = currentPrayer(times, now, 'Asia/Colombo');
    expect(current).toBe('isha');
    expect(next).toBeNull();
  });

  it('is before fajr early morning', () => {
    const now = new Date('2026-05-01T22:30:00Z'); // 04:00 +05:30 next day
    const { current, next } = currentPrayer(times, now, 'Asia/Colombo');
    expect(current).toBeNull();
    expect(next).toBe('fajr');
  });
});
