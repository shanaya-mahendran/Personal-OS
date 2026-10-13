/**
 * /create-event — validated event creation with overlap detection (spec §5.4).
 *
 * Re-validates with Zod; on conflict returns { conflict: true, overlapping }
 * WITHOUT inserting. No silent mutation, ever.
 */
import {
  adminClient,
  fail,
  json,
  requireUser,
  AuthError,
} from '../_shared/env.ts';
import { z } from 'npm:zod@3.24.1';

const EventSchema = z
  .object({
    title: z.string().min(1).max(300),
    description: z.string().max(5000).optional(),
    start_at: z.string().datetime({ offset: true }),
    end_at: z.string().datetime({ offset: true }),
    timezone: z.string().default('Asia/Colombo'),
    location: z.string().max(300).nullable().optional(),
    organizer: z.string().max(300).nullable().optional(),
    force: z.boolean().optional(),
  })
  .refine((e) => new Date(e.end_at).getTime() > new Date(e.start_at).getTime(), {
    message: 'end_at must be after start_at',
    path: ['end_at'],
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }});

  try {
    const userId = await requireUser(req);
    const parsed = EventSchema.safeParse(await req.json());
    if (!parsed.success) {
      return json({ error: 'Invalid event payload', issues: parsed.error.issues }, 422);
    }
    const event = parsed.data;
    const admin = await adminClient();

    if (!event.force) {
      const { data: overlapping, error } = await admin
        .from('events')
        .select('id, title, start_at, end_at, location')
        .eq('user_id', userId)
        .neq('status', 'cancelled')
        .lt('start_at', event.end_at)
        .gt('end_at', event.start_at);
      if (error) return fail(error.message, 500);
      if ((overlapping ?? []).length > 0) {
        // Nothing is inserted: the caller decides.
        return json({ conflict: true, overlapping });
      }
    }

    const { data, error } = await admin
      .from('events')
      .insert({
        user_id: userId,
        title: event.title,
        description: event.description ?? null,
        start_at: event.start_at,
        end_at: event.end_at,
        timezone: event.timezone,
        location: event.location ?? null,
        organizer: event.organizer ?? null,
      })
      .select()
      .single();
    if (error) return fail(error.message, 500);

    await admin.from('audit_logs').insert({
      user_id: userId,
      action: 'create',
      entity_type: 'event',
      entity_id: data.id,
      source: 'user',
      payload: { via: 'create-event-function', conflict_override: Boolean(event.force) },
    });

    return json({ conflict: false, event: data });
  } catch (err) {
    if (err instanceof AuthError) return fail(err.message, 401);
    return json({ error: err instanceof Error ? err.message : 'Unknown error' }, 500);
  }
});
