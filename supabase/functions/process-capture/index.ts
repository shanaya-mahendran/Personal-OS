/**
 * /process-capture — Universal Capture AI extraction (spec §5.2).
 *
 * Input: { capture_id }
 * Flow: fetch capture (ownership via user_id from JWT) → Gemini structured
 * output (vision for images) → Zod validation → confidence per field →
 * store ai_result + confidence → awaiting_confirmation → ai_runs row.
 *
 * The function NEVER creates entities; the user confirms first.
 */
import {
  adminClient,
  checkRateLimit,
  fail,
  json,
  logAiRun,
  requireUser,
  AuthError,
  DEFAULT_TZ,
} from '../_shared/env.ts';
import { generateContent, parseJson, GeminiError } from '../_shared/gemini.ts';
import {
  CaptureResultSchema,
  CAPTURE_RESPONSE_SCHEMA,
  normalizeConfidence,
  type CaptureExtraction,
} from '../_shared/schemas.ts';
import { CAPTURE_SYSTEM_PROMPT } from '../_shared/prompts.ts';

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }});

  const started = Date.now();
  let userId = '';
  try {
    userId = await requireUser(req);
    const body = (await req.json()) as { capture_id?: string };
    if (!body.capture_id) return fail('capture_id is required');

    const admin = await adminClient();

    const { data: capture, error: capErr } = await admin
      .from('captures')
      .select('*')
      .eq('id', body.capture_id)
      .eq('user_id', userId)
      .single();
    if (capErr || !capture) return fail('Capture not found', 404);

    if (!(await checkRateLimit(admin, userId, 'process-capture'))) {
      return json({ error: 'Rate limit: 30 AI calls per hour' }, 429);
    }

    await admin
      .from('captures')
      .update({ processing_status: 'processing' })
      .eq('id', capture.id);

    // Build model input: text and/or image.
    const parts: Array<Record<string, unknown>> = [];
    if (capture.raw_text) {
      parts.push({ text: capture.raw_text });
    }
    if (capture.storage_path) {
      const { data: signed } = await admin.storage
        .from('captures')
        .createSignedUrl(capture.storage_path, 60 * 5);
      if (signed?.signedUrl) {
        const imgRes = await fetch(signed.signedUrl);
        if (imgRes.ok) {
          const buf = new Uint8Array(await imgRes.arrayBuffer());
          let binary = '';
          for (const b of buf) binary += String.fromCharCode(b);
          parts.push({
            inlineData: {
              mimeType: imgRes.headers.get('content-type') ?? 'image/jpeg',
              data: btoa(binary),
            },
          });
        }
      }
    }
    if (parts.length === 0) {
      await admin
        .from('captures')
        .update({ processing_status: 'failed', processed_at: new Date().toISOString() })
        .eq('id', capture.id);
      await logAiRun(admin, userId, {
        function_name: 'process-capture',
        latency_ms: Date.now() - started,
        status: 'error',
        error: 'Empty capture content',
      });
      return fail('Capture has no content');
    }

    const system = CAPTURE_SYSTEM_PROMPT.replaceAll('{iso_now}', new Date().toISOString())
      .replaceAll('{tz}', DEFAULT_TZ);

    const result = await generateContent({
      system,
      contents: [{ role: 'user', parts }],
      responseSchema: CAPTURE_RESPONSE_SCHEMA,
    });

    let extraction: CaptureExtraction;
    try {
      const parsed = CaptureResultSchema.safeParse(parseJson<unknown>(result.text));
      if (!parsed.success) {
        throw new Error(
          `Schema validation failed: ${parsed.error.issues.slice(0, 3).map((i) => i.message).join('; ')}`,
        );
      }
      extraction = parsed.data;
    } catch (err) {
      await admin
        .from('captures')
        .update({ processing_status: 'failed', processed_at: new Date().toISOString() })
        .eq('id', capture.id);
      await logAiRun(admin, userId, {
        function_name: 'process-capture',
        latency_ms: Date.now() - started,
        status: 'error',
        error: err instanceof Error ? err.message : 'invalid AI output',
        prompt_tokens: result.promptTokens,
        completion_tokens: result.completionTokens,
      });
      return fail('AI output failed validation; capture preserved', 422);
    }

    const confidence = normalizeConfidence(
      extraction.confidence,
      CONTENT_FIELDS[extraction.type] ?? CONFIDENCE_FIELDS,
    );
    const { confidence: _drop, ...aiResult } = extraction;

    const { error: updErr } = await admin
      .from('captures')
      .update({
        ai_result: aiResult as unknown as Record<string, never>,
        confidence: confidence as unknown as Record<string, never>,
        processing_status: 'awaiting_confirmation',
        processed_at: new Date().toISOString(),
      })
      .eq('id', capture.id);
    if (updErr) return fail(updErr.message, 500);

    await logAiRun(admin, userId, {
      function_name: 'process-capture',
      latency_ms: Date.now() - started,
      status: 'ok',
      prompt_tokens: result.promptTokens,
      completion_tokens: result.completionTokens,
    });

    return json({ ok: true, capture_id: capture.id, type: aiResult.type, confidence });
  } catch (err) {
    if (err instanceof AuthError) return fail(err.message, 401);
    const message = err instanceof GeminiError ? err.message : (err instanceof Error ? err.message : 'Unknown error');
    if (userId) {
      try {
        const admin = await adminClient();
        await logAiRun(admin, userId, {
          function_name: 'process-capture',
          latency_ms: Date.now() - started,
          status: 'error',
          error: message,
        });
      } catch {
        // logging must not mask the error
      }
    }
    return json({ error: message }, 500);
  }
});
