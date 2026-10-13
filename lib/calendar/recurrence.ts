/**
 * Minimal iCal RRULE expansion, client-side only (spec §11).
 * Supports FREQ=DAILY|WEEKLY|MONTHLY|YEARLY with INTERVAL, BYDAY, COUNT, UNTIL.
 * The first occurrence is DTSTART itself (except weekly BYDAY rules, which
 * start at the first matching weekday on/after DTSTART).
 * Deliberately small: each confirmed occurrence becomes its own task row.
 */

export interface RRULE {
  FREQ: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
  INTERVAL?: number;
  BYDAY?: string[];
  COUNT?: number;
  UNTIL?: string;
}

export function parseRRule(rule: string): RRULE | null {
  const body = rule.startsWith('RRULE:') ? rule.slice(6) : rule;
  const parts = Object.fromEntries(
    body.split(';').map((kv) => {
      const [k, v] = kv.split('=');
      return [(k ?? '').trim(), (v ?? '').trim()];
    }),
  );
  const freq = parts.FREQ as RRULE['FREQ'] | undefined;
  if (freq !== 'DAILY' && freq !== 'WEEKLY' && freq !== 'MONTHLY' && freq !== 'YEARLY') {
    return null;
  }
  return {
    FREQ: freq,
    INTERVAL: parts.INTERVAL ? Number(parts.INTERVAL) : undefined,
    BYDAY: parts.BYDAY ? parts.BYDAY.split(',') : undefined,
    COUNT: parts.COUNT ? Number(parts.COUNT) : undefined,
    UNTIL: parts.UNTIL,
  };
}

const DAY_INDEX: Record<string, number> = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

function parseUntil(until: string | undefined): Date | null {
  if (!until) return null;
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(until);
  if (!m) return new Date(until);
  return new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z`);
}

/** Monday-based week index for a date (local calendar days). */
function mondayWeekIndex(d: Date): number {
  const day = (d.getDay() + 6) % 7; // 0 = Monday
  const monday = new Date(d);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - day);
  return Math.floor(monday.getTime() / (7 * 86_400_000));
}

/** Expand a rule into occurrence dates starting from `startDate`. */
export function expandRRule(
  rule: string,
  startDate: Date,
  maxOccurrences = 365,
  now: Date = new Date(),
): Date[] {
  void now; // kept for API compatibility: expansions start at DTSTART
  const parsed = parseRRule(rule);
  if (!parsed) return [];

  const interval = Math.max(1, Math.floor(parsed.INTERVAL ?? 1));
  const limit = Math.max(1, Math.min(parsed.COUNT ?? maxOccurrences, maxOccurrences));
  const until = parseUntil(parsed.UNTIL);
  const out: Date[] = [];

  const canPush = (d: Date) => !until || d.getTime() <= until.getTime();
  const push = (d: Date): boolean => {
    if (!canPush(d)) return false;
    out.push(new Date(d));
    return out.length < limit;
  };

  // Weekly + BYDAY: day-by-day scan honouring the week interval.
  if (parsed.FREQ === 'WEEKLY' && parsed.BYDAY && parsed.BYDAY.length > 0) {
    const cursor = new Date(startDate);
    cursor.setMinutes(0, 0, 0);
    const startWeek = mondayWeekIndex(cursor);
    let guard = 0;
    while (out.length < limit && guard++ < 4000) {
      if (until && cursor.getTime() > until.getTime()) break;
      const matches = parsed.BYDAY.some((bd) => DAY_INDEX[bd] === cursor.getDay());
      const weekOk = (mondayWeekIndex(cursor) - startWeek) % interval === 0;
      if (matches && weekOk && !push(cursor)) break;
      cursor.setDate(cursor.getDate() + 1);
    }
    return out;
  }

  const cursor = new Date(startDate);
  if (!push(cursor)) return out;

  let guard = 0;
  while (out.length < limit && guard++ < 4000) {
    if (parsed.FREQ === 'DAILY') {
      cursor.setDate(cursor.getDate() + interval);
    } else if (parsed.FREQ === 'WEEKLY') {
      cursor.setDate(cursor.getDate() + 7 * interval);
    } else if (parsed.FREQ === 'MONTHLY') {
      cursor.setMonth(cursor.getMonth() + interval);
    } else {
      cursor.setFullYear(cursor.getFullYear() + interval);
    }
    if (!canPush(cursor)) break;
    out.push(new Date(cursor));
  }

  return out;
}
