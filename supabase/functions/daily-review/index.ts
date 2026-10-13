/**
 * /daily-review — end-of-day digest generator (spec §16/§18).
 *
 * Builds a plain-text review of the day (tasks done/open, events attended,
 * prayers logged) and inserts a notification row. Read-only with respect to
 * user content; one notification per day, idempotent by title+date.
 */
import { adminClient, fail, json, requireUser, AuthError, DEFAULT_TZ } from '../_shared/env.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }});

  try {
    const userId = await requireUser(req);
    const admin = await adminClient();

    const today = new Date().toLocaleDateString('en-CA', { timeZone: DEFAULT_TZ });
    const dayStart = new Date(`${today}T00:00:00+05:30`);
    const dayEnd = new Date(dayStart.getTime() + 86_400_000);

    const [tasksRes, eventsRes, prayersRes] = await Promise.all([
      admin
        .from('tasks')
        .select('id, title, status, completed_at')
        .eq('user_id', userId)
        .neq('status', 'cancelled')
        .or(`completed_at.gte.${dayStart.toISOString()},and(status.neq.done,due_at.lt.${dayEnd.toISOString()},due_at.gte.${dayStart.toISOString()})`)
        .limit(50),
      admin
        .from('events')
        .select('id, title, start_at, end_at, status')
        .eq('user_id', userId)
        .lt('start_at', dayEnd.toISOString())
        .gt('end_at', dayStart.toISOString()),
      admin.from('prayer_logs').select('prayer, completed').eq('user_id', userId).eq('date', today),
    ]);

    const tasks = tasksRes.data ?? [];
    const done = tasks.filter((t) => t.status === 'done');
    const open = tasks.filter((t) => t.status !== 'done');
    const events = eventsRes.data ?? [];
    const prayersDone = (prayersRes.data ?? []).filter((p) => p.completed).length;

    const lines = [
      `Daily review · ${today}`,
      `${done.length}/${tasks.length} tasks completed, ${open.length} still open.`,
      `${events.length} events today.`,
      `${prayersCount(prayersDone)} prayers logged.`,
      open.length > 0 ? `First open task: ${open[0]!.title}` : 'Everything due today is done.',
    ];

    const body = lines.join('\n');

    // Idempotent: skip if today's review already exists.
    const { data: existing } = await admin
      .from('notifications')
      .select('id')
      .eq('user_id', userId)
      .eq('title', `Daily review ${today}`)
      .maybeSingle();

    if (!existing) {
      await admin.from('notifications').insert({
        user_id: userId,
        title: `Daily review ${today}`,
        body,
        scheduled_at: new Date().toISOString(),
        sent_at: new Date().toISOString(),
        entity_type: 'daily_review',
      });
    }

    return json({ ok: true, date: today, review: body, notification_created: !existing });
  } catch (err) {
    if (err instanceof AuthError) return fail(err.message, 401);
    return json({ error: err instanceof Error ? err.message : 'Unknown error' }, 500);
  }
});

function prayersCount(n: number): string {
  return String(n);
}
