/**
 * /sync-prayer-schedule — server-side import helper for annual schedules.
 *
 * Validates 365/366 rows, HH:MM times, and date↔year integrity, then writes
 * in one replace operation. No calculation: only user-provided times.
 * (The client uses the server action; this function exists for CSV uploads
 * from other clients / automation.)
 */
import { adminClient, fail, json, requireUser, AuthError } from '../_shared/env.ts';
import { z } from 'npm:zod@3.24.1';

const RowSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  fajr: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  dhuhr: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  asr: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  maghrib: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  isha: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
});

const InputSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  rows: z.array(RowSchema).min(365).max(366),
});

function daysInYear(year: number): number {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 366 : 365;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }});

  try {
    const userId = await requireUser(req);
    const parsed = InputSchema.safeParse(await req.json());
    if (!parsed.success) {
      return json({ error: 'Invalid schedule payload', issues: parsed.error.issues.slice(0, 5) }, 422);
    }
    const { year, rows } = parsed.data;

    const expected = daysInYear(year);
    const seen = new Set(rows.map((r) => r.date));
    if (rows.length !== expected || seen.size !== expected) {
      return fail(`Expected ${expected} distinct dates for ${year}`, 422);
    }
    for (const row of rows) {
      if (Number(row.date.slice(0, 4)) !== year) {
        return fail(`Date ${row.date} does not match year ${year}`, 422);
      }
    }

    const admin = await adminClient();

    const { error: delErr } = await admin
      .from('prayer_schedules')
      .delete()
      .eq('user_id', userId)
      .eq('schedule_year', year);
    if (delErr) return fail(delErr.message, 500);

    for (let i = 0; i < rows.length; i += 100) {
      const chunk = rows.slice(i, i + 100).map((r) => ({
        user_id: userId,
        date: r.date,
        fajr: r.fajr,
        dhuhr: r.dhuhr,
        asr: r.asr,
        maghrib: r.maghrib,
        isha: r.isha,
        schedule_year: year,
      }));
      const { error } = await admin.from('prayer_schedules').insert(chunk);
      if (error) return fail(error.message, 500);
    }

    await admin.from('audit_logs').insert({
      user_id: userId,
      action: 'import_schedule',
      entity_type: 'prayer_schedule',
      source: 'user',
      payload: { year, rows: rows.length },
    });

    return json({ ok: true, inserted: rows.length, year });
  } catch (err) {
    if (err instanceof AuthError) return fail(err.message, 401);
    return json({ error: err instanceof Error ? err.message : 'Unknown error' }, 500);
  }
});
