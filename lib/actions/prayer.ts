'use server';

/**
 * Prayer module actions: annual schedule import + daily completion.
 * Schedule rows are user-provided; there is no calculation code path.
 */
import { z } from 'zod';
import { PRAYER_COLUMNS, validateSchedule, type PrayerRow } from '@/lib/prayer/validation';
import { PRAYERS } from '@/lib/prayer/lookup';
import { ActionError, audit, errorMessage, revalidateApp, requireContext } from './helpers';

export interface PrayerActionResult<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}

const ScheduleRowsSchema = z.array(
  z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    fajr: z.string(),
    dhuhr: z.string(),
    asr: z.string(),
    maghrib: z.string(),
    isha: z.string(),
  }),
);

export const ImportPlanSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  rows: ScheduleRowsSchema,
  /** When replacing an existing year the client must acknowledge the diff. */
  replace: z.boolean().default(false),
});

export type ImportPreview = {
  ok: boolean;
  errors: string[];
  warnings: string[];
  existing: number;
  added: number;
  updated: number;
  unchanged: number;
  sample: { date: string; before: string | null; after: string }[];
};

/** Validate + diff without writing (preview before import). */
export async function previewScheduleImport(input: unknown): Promise<
  PrayerActionResult<ImportPreview>
> {
  try {
    const { year, rows, replace } = ImportPlanSchema.parse(input);
    const validation = validateSchedule(rows as PrayerRow[], year);
    const { supabase, userId } = await requireContext();

    const { data: existingRows } = await supabase
      .from('prayer_schedules')
      .select('date, fajr, dhuhr, asr, maghrib, isha')
      .eq('user_id', userId)
      .eq('schedule_year', year);

    const existingMap = new Map(
      (existingRows ?? []).map((r) => [r.date, `${r.fajr},${r.dhuhr},${r.asr},${r.maghrib},${r.isha}`]),
    );

    let added = 0;
    let updated = 0;
    let unchanged = 0;
    const sample: ImportPreview['sample'] = [];
    for (const row of rows) {
      const next = `${row.fajr},${row.dhuhr},${row.asr},${row.maghrib},${row.isha}`;
      const prev = existingMap.get(row.date);
      if (!prev) {
        added += 1;
        if (sample.length < 5) sample.push({ date: row.date, before: null, after: next });
      } else if (prev !== next) {
        updated += 1;
        if (sample.length < 5) sample.push({ date: row.date, before: prev, after: next });
      } else {
        unchanged += 1;
      }
    }

    if (existingRows && existingRows.length > 0 && !replace) {
      return {
        ok: false,
        error: `${existingRows.length} rows already exist for ${year}. Confirm replacement to overwrite.`,
      };
    }

    return {
      ok: validation.ok,
      data: {
        ok: validation.ok,
        errors: validation.errors,
        warnings: validation.warnings,
        existing: existingRows?.length ?? 0,
        added,
        updated,
        unchanged,
        sample,
      },
      error: validation.ok ? undefined : 'Validation failed',
    };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

/** Write the full year in one transaction-ish batch. */
export async function importSchedule(input: unknown): Promise<
  PrayerActionResult<{ inserted: number }>
> {
  try {
    const { year, rows } = ImportPlanSchema.parse(input);
    const validation = validateSchedule(rows as PrayerRow[], year);
    if (!validation.ok) {
      return { ok: false, error: `Schedule invalid: ${validation.errors[0] ?? 'unknown error'}` };
    }

    const { supabase, userId } = await requireContext();

    // Replace year atomically: delete then insert.
    const { error: delErr } = await supabase
      .from('prayer_schedules')
      .delete()
      .eq('user_id', userId)
      .eq('schedule_year', year);
    if (delErr) throw new ActionError(delErr.message);

    const payload = rows.map((r) => ({
      user_id: userId,
      date: r.date,
      fajr: r.fajr,
      dhuhr: r.dhuhr,
      asr: r.asr,
      maghrib: r.maghrib,
      isha: r.isha,
      schedule_year: year,
    }));

    // Insert in chunks to stay within request size limits.
    for (let i = 0; i < payload.length; i += 100) {
      const { error } = await supabase.from('prayer_schedules').insert(payload.slice(i, i + 100));
      if (error) throw new ActionError(error.message);
    }

    await audit(supabase, userId, {
      action: 'import_schedule',
      entity_type: 'prayer_schedule',
      payload: { year, rows: rows.length, columns: PRAYER_COLUMNS },
    });
    revalidateApp(['/prayers', '/prayers/schedule', '/dashboard']);
    return { ok: true, data: { inserted: rows.length } };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

const ToggleSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  prayer: z.enum(['fajr', 'dhuhr', 'asr', 'maghrib', 'isha']),
  completed: z.boolean(),
});

/** Toggle a prayer's completion for a day (independent of the schedule). */
export async function togglePrayer(input: unknown): Promise<PrayerActionResult> {
  try {
    const { date, prayer, completed } = ToggleSchema.parse(input);
    const { supabase, userId } = await requireContext();

    const { error } = await supabase
      .from('prayer_logs')
      .upsert(
        {
          user_id: userId,
          date,
          prayer: prayer as (typeof PRAYERS)[number],
          completed,
          completed_at: completed ? new Date().toISOString() : null,
        },
        { onConflict: 'user_id,date,prayer' },
      );
    if (error) throw new ActionError(error.message);

    await audit(supabase, userId, {
      action: completed ? 'prayer_complete' : 'prayer_uncomplete',
      entity_type: 'prayer_log',
      payload: { date, prayer },
    });
    revalidateApp(['/prayers', '/dashboard']);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}
