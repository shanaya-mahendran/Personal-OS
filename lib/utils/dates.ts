/**
 * Timezone-aware date utilities.
 *
 * Shanaya OS stores every timestamp as timestamptz and always renders in the
 * user's configured timezone (default Asia/Colombo). Display strings are never
 * persisted as dates.
 */

export const DEFAULT_TZ = 'Asia/Colombo';

/** The IANA timezone the current browser/OS reports. */
export function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_TZ;
  } catch {
    return DEFAULT_TZ;
  }
}

/** Now as an ISO-8601 instant string (UTC). */
export function isoNow(): string {
  return new Date().toISOString();
}

/** Format a Date/ISO string as HH:MM in the given timezone. */
export function formatTime(
  value: string | Date,
  timeZone: string = DEFAULT_TZ,
): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone,
  }).format(date);
}

/** Format a Date/ISO string as e.g. "Mon, 6 Oct 2025" in the given timezone. */
export function formatDate(
  value: string | Date,
  timeZone: string = DEFAULT_TZ,
): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone,
  }).format(date);
}

/** Calendar key (YYYY-MM-DD) for a moment in a given timezone. */
export function calendarKey(
  value: string | Date = new Date(),
  timeZone: string = DEFAULT_TZ,
): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  const parts = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone,
  }).formatToParts(date);
  const get = (type: string): string =>
    parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** "YYYY-MM-DD" -> "D Mmm YYYY" (schedule rows are plain calendar dates). */
export function formatDateKey(key: string, timeZone?: string): string {
  const [y, m, d] = key.split('-').map(Number);
  if (!y || !m || !d) return key;
  return formatDate(new Date(Date.UTC(y, m - 1, d, 12)), timeZone ?? 'UTC');
}

/** Minutes since midnight for an HH:MM or HH:MM:SS string. */
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** Minutes from now until an ISO instant (negative = past). */
export function minutesUntil(iso: string, now: Date = new Date()): number {
  return Math.round((new Date(iso).getTime() - now.getTime()) / 60_000);
}

/** Human relative label: "in 15 min", "2h 30m", "3d". */
export function relativeLabel(iso: string, now: Date = new Date()): string {
  const mins = minutesUntil(iso, now);
  const abs = Math.abs(mins);
  const suffix = mins >= 0 ? '' : ' ago';
  if (abs < 1) return mins >= 0 ? 'now' : 'just now';
  if (abs < 60) return `${abs} min${suffix}`;
  if (abs < 60 * 24) {
    const h = Math.floor(abs / 60);
    const m = abs % 60;
    return m > 0 ? `${h}h ${m}m${suffix}` : `${h}h${suffix}`;
  }
  const d = Math.floor(abs / (60 * 24));
  return `${d}d${suffix}`;
}

/** True when now is within [start, end]. */
export function isOngoing(
  startAt: string,
  endAt: string,
  now: Date = new Date(),
): boolean {
  const s = new Date(startAt).getTime();
  const e = new Date(endAt).getTime();
  const t = now.getTime();
  return s <= t && t <= e;
}

/** Start/end of a calendar day (YYYY-MM-DD) as UTC-noon-anchored Dates. */
export function dayRange(
  key: string,
): { start: Date; end: Date } {
  const [y, m, d] = key.split('-').map(Number);
  const start = new Date(Date.UTC((y ?? 1970) - 1, (m ?? 1) - 1, d ?? 1, 0, 0, 0));
  const end = new Date(start.getTime());
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

/** Number of days in a (leap-aware) year. */
export function daysInYear(year: number): number {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 366 : 365;
}

/** Validate a plain calendar date key against a year. */
export function dateMatchesYear(key: string, year: number): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!match) return false;
  const [, y, mo, d] = match.map(Number);
  if (y !== year) return false;
  if (!mo || !d || mo < 1 || mo > 12) return false;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}
