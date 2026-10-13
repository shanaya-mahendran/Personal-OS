/**
 * Prayer schedule validation (spec §9).
 * CSV columns: date,fajr,dhuhr,asr,maghrib,isha
 * - 365/366 rows covering the whole schedule_year
 * - times in HH:MM (24h)
 * - every date must fall inside schedule_year
 * No automatic calculation, ever.
 */
import { daysInYear, dateMatchesYear } from '@/lib/utils/dates';

export const PRAYER_COLUMNS = ['date', 'fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] as const;
export type PrayerColumn = (typeof PRAYER_COLUMNS)[number];
export type PrayerRow = Record<PrayerColumn, string>;

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export interface ScheduleValidation {
  ok: boolean;
  rows: PrayerRow[];
  errors: string[];
  warnings: string[];
  year: number | null;
  expectedDays: number | null;
}

export function validateTime(value: string): boolean {
  return TIME_RE.test(value.trim());
}

/** Parse CSV text into rows, normalizing time values. */
export function parseScheduleCsv(text: string): { rows: PrayerRow[]; errors: string[] } {
  const errors: string[] = [];
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length === 0) return { rows: [], errors: ['File is empty'] };

  const header = lines[0]!.split(',').map((h) => h.trim().toLowerCase());
  const hasHeader = PRAYER_COLUMNS.every((c) => header.includes(c));
  const dataLines = hasHeader ? lines.slice(1) : lines;
  const colIndex: Record<PrayerColumn, number> = {
    date: 0,
    fajr: 1,
    dhuhr: 2,
    asr: 3,
    maghrib: 4,
    isha: 5,
  };
  if (hasHeader) {
    for (const c of PRAYER_COLUMNS) {
      const idx = header.indexOf(c);
      if (idx >= 0) colIndex[c] = idx;
    }
  }

  const rows: PrayerRow[] = [];
  dataLines.forEach((line, i) => {
    const cells = line.split(',').map((c) => c.trim());
    const row = {
      date: cells[colIndex.date] ?? '',
      fajr: cells[colIndex.fajr] ?? '',
      dhuhr: cells[colIndex.dhuhr] ?? '',
      asr: cells[colIndex.asr] ?? '',
      maghrib: cells[colIndex.maghrib] ?? '',
      isha: cells[colIndex.isha] ?? '',
    };
    if (!DATE_RE.test(row.date)) errors.push(`Row ${i + 1}: invalid date "${row.date}"`);
    for (const p of ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] as const) {
      if (!validateTime(row[p])) errors.push(`Row ${i + 1}: invalid ${p} time "${row[p]}"`);
    }
    rows.push(row);
  });

  return { rows, errors };
}

/** Full validation of a parsed schedule against a target year. */
export function validateSchedule(rows: PrayerRow[], year: number): ScheduleValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const expected = daysInYear(year);

  if (rows.length !== expected) {
    errors.push(`Expected ${expected} rows for ${year}, received ${rows.length}`);
  }

  const seen = new Set<string>();
  for (const row of rows) {
    if (seen.has(row.date)) errors.push(`Duplicate date ${row.date}`);
    seen.add(row.date);
    if (!dateMatchesYear(row.date, year)) {
      errors.push(`Date ${row.date} does not fall in ${year}`);
    }
    for (const p of ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] as const) {
      if (!validateTime(row[p])) errors.push(`${row.date}: invalid ${p} time "${row[p]}"`);
    }
  }

  // Ensure every day of the year is present.
  if (rows.length > 0) {
    const expectedSet = new Set<string>();
    const start = Date.UTC(year, 0, 1);
    for (let i = 0; i < expected; i++) {
      const d = new Date(start + i * 86_400_000);
      expectedSet.add(d.toISOString().slice(0, 10));
    }
    for (const key of expectedSet) {
      if (!seen.has(key)) errors.push(`Missing date ${key}`);
    }
  }

  // Sanity: fajr before dhuhr before asr before maghrib before isha.
  const order: PrayerColumn[] = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
  for (const row of rows) {
    const minutes = order.map((p) => {
      const [h, m] = row[p].split(':').map(Number);
      return (h ?? 0) * 60 + (m ?? 0);
    });
    for (let i = 1; i < minutes.length; i++) {
      if ((minutes[i] ?? 0) < (minutes[i - 1] ?? 0)) {
        warnings.push(`${row.date}: ${order[i]} is before ${order[i - 1]}`);
        break;
      }
    }
  }

  return {
    ok: errors.length === 0,
    rows,
    errors: errors.slice(0, 50),
    warnings: warnings.slice(0, 20),
    year,
    expectedDays: expected,
  };
}
