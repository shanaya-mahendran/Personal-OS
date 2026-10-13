'use server';

/**
 * Universal Capture actions (spec §6).
 *
 * Flow: submit → row with processing_status='pending' → invoke the
 * /process-capture Edge Function (Gemini key lives only there) → the client
 * polls the row until it reaches awaiting_confirmation → user edits/confirms
 * → we create the entity, run conflict detection for events, link it back.
 *
 * Provenance: raw_text and storage_path are never deleted by any code path.
 */
import { z } from 'zod';
import { CaptureInputSchema, ConfirmCaptureSchema } from '@/lib/validation/capture';
import { EventCreateSchema } from '@/lib/validation/event';
import { TaskCreateSchema } from '@/lib/validation/task';
import { MemoryCreateSchema, NoteCreateSchema, OpportunityCreateSchema } from '@/lib/validation/career';
import { detectConflicts, type OverlappingEvent } from '@/lib/calendar/conflicts';
import { generateContent, parseJsonText } from '@/lib/gemini/client';
import { CAPTURE_SYSTEM_PROMPT } from '@/lib/gemini/prompts';
import { CaptureResultSchema } from '@/lib/gemini/schemas';
import { normalizeConfidence } from '@/lib/ai/confidence';
import type { CaptureRow, Database } from '@/lib/supabase/types';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  ActionError,
  audit,
  errorMessage,
  revalidateApp,
  requireContext,
} from './helpers';

export interface CaptureResult<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}

const CONFIDENCE_FIELDS = [
  'title',
  'date',
  'time',
  'location',
  'organizer',
  'description',
  'company',
  'role',
  'body',
  'kind',
  'url',
  'reason',
];

const CONTENT_FIELDS: Record<string, string[]> = {
  task: ['title', 'date', 'time', 'description', 'reason'],
  event: ['title', 'date', 'time', 'location', 'organizer', 'description'],
  career_opportunity: ['company', 'role', 'url', 'date', 'location', 'description'],
  note: ['title', 'body'],
  memory: ['title', 'body', 'kind'],
  reminder: ['title', 'date', 'time'],
  unknown: ['reason'],
};

async function processCaptureDirect(
  supabase: SupabaseClient<Database>,
  userId: string,
  captureId: string,
): Promise<void> {
  try {
    const { data: capture } = await supabase
      .from('captures')
      .select('*')
      .eq('id', captureId)
      .eq('user_id', userId)
      .single();
    if (!capture) return;

    await supabase
      .from('captures')
      .update({ processing_status: 'processing' })
      .eq('id', captureId);

    const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [];
    if (capture.raw_text) {
      parts.push({ text: capture.raw_text });
    }
    if (capture.storage_path) {
      const { data: signed } = await supabase.storage
        .from('captures')
        .createSignedUrl(capture.storage_path, 60 * 5);
      if (signed?.signedUrl) {
        const imgRes = await fetch(signed.signedUrl);
        if (imgRes.ok) {
          const buf = Buffer.from(await imgRes.arrayBuffer());
          parts.push({
            inlineData: {
              mimeType: imgRes.headers.get('content-type') ?? 'image/jpeg',
              data: buf.toString('base64'),
            },
          });
        }
      }
    }

    if (parts.length === 0) {
      await supabase
        .from('captures')
        .update({ processing_status: 'failed', processed_at: new Date().toISOString() })
        .eq('id', captureId);
      return;
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('timezone')
      .eq('id', userId)
      .maybeSingle();

    const tz = profile?.timezone || 'Asia/Colombo';
    const system = CAPTURE_SYSTEM_PROMPT.replaceAll('{iso_now}', new Date().toISOString())
      .replaceAll('{tz}', tz);

    const result = await generateContent({
      system,
      contents: [{ role: 'user', parts }],
    });

    const parsed = CaptureResultSchema.safeParse(parseJsonText<unknown>(result.text));
    if (!parsed.success) {
      await supabase
        .from('captures')
        .update({ processing_status: 'failed', processed_at: new Date().toISOString() })
        .eq('id', captureId);
      return;
    }

    const extraction = parsed.data;
    const confidence = normalizeConfidence(
      (extraction as unknown as { confidence?: Record<string, number> }).confidence,
      CONTENT_FIELDS[extraction.type] ?? CONFIDENCE_FIELDS,
    );
    const aiResult = { ...extraction } as Record<string, unknown>;
    delete aiResult.confidence;

    await supabase
      .from('captures')
      .update({
        ai_result: aiResult as unknown as Record<string, never>,
        confidence: confidence as unknown as Record<string, never>,
        processing_status: 'awaiting_confirmation',
        processed_at: new Date().toISOString(),
      })
      .eq('id', captureId);

    revalidateApp(['/inbox', '/dashboard']);
  } catch (err) {
    console.warn('Direct capture processing failed:', err);
    await supabase
      .from('captures')
      .update({ processing_status: 'failed', processed_at: new Date().toISOString() })
      .eq('id', captureId);
  }
}

/** Invoke an Edge Function with the caller's JWT (never the service key). */
async function invokeEdge<T>(
  supabase: SupabaseClient<Database>,
  name: string,
  body: Record<string, unknown>,
): Promise<T | null> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return null;
    const res = await supabase.functions.invoke(name, {
      body,
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (res.error) return null;
    return res.data as T;
  } catch {
    return null;
  }
}

/** Step 1: create the capture row and kick off AI processing. */
export async function submitCapture(input: unknown): Promise<CaptureResult<{ id: string }>> {
  try {
    const parsed = CaptureInputSchema.parse(input);
    const { supabase, userId } = await requireContext();

    const { data, error } = await supabase
      .from('captures')
      .insert({
        user_id: userId,
        raw_text: parsed.raw_text ?? null,
        storage_path: parsed.storage_path ?? null,
        input_type: parsed.input_type,
        processing_status: 'pending',
      })
      .select('id')
      .single();
    if (error) throw new ActionError(error.message);

    // Fire processing directly if server has GEMINI_API_KEY, else edge function
    if (process.env.GEMINI_API_KEY) {
      void processCaptureDirect(supabase, userId, data.id);
    } else {
      void invokeEdge(supabase, 'process-capture', { capture_id: data.id });
    }

    revalidateApp(['/inbox', '/dashboard']);
    return { ok: true, data: { id: data.id } };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

/** Retry processing for a capture stuck in pending/failed. */
export async function reprocessCapture(id: string): Promise<CaptureResult> {
  try {
    const { supabase, userId } = await requireContext();
    await supabase
      .from('captures')
      .update({ processing_status: 'pending' })
      .eq('id', id)
      .eq('user_id', userId);

    if (process.env.GEMINI_API_KEY) {
      await processCaptureDirect(supabase, userId, id);
      return { ok: true };
    }
    const out = await invokeEdge(supabase, 'process-capture', { capture_id: id });
    return { ok: true, data: out };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

/** Step 2: read a capture back for the preview sheet. */
export async function getCapture(id: string): Promise<CaptureResult<CaptureRow>> {
  try {
    const { supabase, userId } = await requireContext();
    const { data, error } = await supabase
      .from('captures')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();
    if (error) throw new ActionError(error.message);
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

export async function rejectCapture(id: string): Promise<CaptureResult> {
  try {
    const { supabase, userId } = await requireContext();
    const { error } = await supabase
      .from('captures')
      .update({ processing_status: 'rejected' })
      .eq('id', id)
      .eq('user_id', userId);
    if (error) throw new ActionError(error.message);
    // raw_text/storage_path are intentionally untouched (provenance).
    await audit(supabase, userId, {
      action: 'reject',
      entity_type: 'capture',
      entity_id: id,
    });
    revalidateApp(['/inbox', '/dashboard']);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

export type ConfirmOutcome =
  | { status: 'created'; entity_type: string; entity_id: string }
  | { status: 'conflict'; overlapping: OverlappingEvent[]; pending_payload: unknown };

/**
 * Step 3: user confirms the (possibly edited) proposal → create the entity.
 * Events are conflict-checked; on conflict nothing is written.
 */
export async function confirmCapture(input: unknown): Promise<CaptureResult<ConfirmOutcome>> {
  try {
    const { capture_id, entity_type, payload } = ConfirmCaptureSchema.parse(input);
    const { supabase, userId } = await requireContext();

    const { data: capture, error: capErr } = await supabase
      .from('captures')
      .select('id, processing_status')
      .eq('id', capture_id)
      .eq('user_id', userId)
      .single();
    if (capErr || !capture) throw new ActionError('Capture not found');
    if (capture.processing_status === 'confirmed') {
      throw new ActionError('Capture already confirmed');
    }

    let entityId: string;
    let table: string;

    switch (entity_type) {
      case 'task': {
        const parsed = TaskCreateSchema.parse({
          ...(payload as object),
          source_capture_id: capture_id,
        });
        const { data, error } = await supabase
          .from('tasks')
          .insert({ ...parsed, user_id: userId })
          .select('id')
          .single();
        if (error) throw new ActionError(error.message);
        entityId = data.id;
        table = 'tasks';
        break;
      }
      case 'event': {
        // `force` ("Keep both") is an explicit user acknowledgement that
        // bypasses the conflict refusal — never automatic.
        const force = Boolean((payload as Record<string, unknown>).force);
        const parsed = EventCreateSchema.parse(payload);
        // Conflict detection before insert (spec §10).
        const overlapping = force
          ? []
          : await detectConflicts(supabase, userId, {
              start_at: parsed.start_at,
              end_at: parsed.end_at,
            });
        if (overlapping.length > 0) {
          return {
            ok: true,
            data: { status: 'conflict', overlapping, pending_payload: payload },
          };
        }
        // Link provenance through event_sources.
        const { data: src, error: srcErr } = await supabase
          .from('event_sources')
          .insert({ user_id: userId, capture_id, type: 'capture' })
          .select('id')
          .single();
        if (srcErr) throw new ActionError(srcErr.message);
        const { data, error } = await supabase
          .from('events')
          .insert({ ...parsed, user_id: userId, source_id: src.id })
          .select('id')
          .single();
        if (error) throw new ActionError(error.message);
        entityId = data.id;
        table = 'events';
        break;
      }
      case 'note': {
        const parsed = NoteCreateSchema.parse({
          ...(payload as object),
          source_capture_id: capture_id,
        });
        const { data, error } = await supabase
          .from('notes')
          .insert({ ...parsed, user_id: userId })
          .select('id')
          .single();
        if (error) throw new ActionError(error.message);
        entityId = data.id;
        table = 'notes';
        break;
      }
      case 'memory': {
        const parsed = MemoryCreateSchema.parse({
          ...(payload as object),
          source_capture_id: capture_id,
        });
        const { data, error } = await supabase
          .from('memories')
          .insert({ ...parsed, user_id: userId })
          .select('id')
          .single();
        if (error) throw new ActionError(error.message);
        entityId = data.id;
        table = 'memories';
        // Fire-and-forget embedding generation (server-side only).
        void invokeEdge(supabase, 'generate-embedding', { memory_id: data.id });
        break;
      }
      case 'career_opportunity': {
        // The extraction schema uses `opportunity_type` (the discriminator
        // owns the `type` key); map it to the column before validation.
        const raw = { ...(payload as Record<string, unknown>) };
        if (raw.opportunity_type !== undefined) {
          raw.type = raw.opportunity_type;
          delete raw.opportunity_type;
        }
        const parsed = OpportunityCreateSchema.parse({
          ...raw,
          source_capture_id: capture_id,
        });
        const { data, error } = await supabase
          .from('career_opportunities')
          .insert({ ...parsed, user_id: userId })
          .select('id')
          .single();
        if (error) throw new ActionError(error.message);
        entityId = data.id;
        table = 'career_opportunities';
        break;
      }
      case 'reminder': {
        const parsed = z
          .object({
            title: z.string().min(1).max(300),
            remind_at: z.string().datetime({ offset: true }),
          })
          .parse(payload);
        const { data, error } = await supabase
          .from('tasks')
          .insert({
            user_id: userId,
            title: parsed.title,
            reminder_at: parsed.remind_at,
            due_at: parsed.remind_at,
            priority: 'medium',
            source_capture_id: capture_id,
          })
          .select('id')
          .single();
        if (error) throw new ActionError(error.message);
        entityId = data.id;
        table = 'tasks';
        break;
      }
      default:
        throw new ActionError('Unsupported entity type');
    }

    const { error: updErr } = await supabase
      .from('captures')
      .update({
        processing_status: 'confirmed',
        created_entity_type: entity_type,
        created_entity_id: entityId,
      })
      .eq('id', capture_id);
    if (updErr) throw new ActionError(updErr.message);

    await audit(supabase, userId, {
      action: 'confirm_capture',
      entity_type,
      entity_id: entityId,
      payload: { capture_id, table },
    });

    revalidateApp(['/inbox', '/dashboard', '/tasks', '/calendar', '/memory']);
    return { ok: true, data: { status: 'created', entity_type, entity_id: entityId } };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}
