/**
 * /generate-embedding — semantic memory embeddings (spec §5.6).
 *
 * Input: { memory_id }  → embed memory text into memory_embeddings
 * Input: { text }       → embed an ad-hoc query (used by /memory search)
 *
 * Both verify ownership first. GEMINI_API_KEY stays server-side.
 */
import { adminClient, fail, json, requireUser, AuthError } from '../_shared/env.ts';
import { embedText, GeminiError } from '../_shared/gemini.ts';
import { z } from 'npm:zod@3.24.1';

const InputSchema = z.union([
  z.object({ memory_id: z.string().uuid() }),
  z.object({ text: z.string().min(1).max(8000) }),
]);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }});

  try {
    const userId = await requireUser(req);
    const parsed = InputSchema.safeParse(await req.json());
    if (!parsed.success) return fail('memory_id or text is required', 422);

    const admin = await adminClient();

    if ('text' in parsed.data) {
      const embedding = await embedText(parsed.data.text);
      return json({ embedding });
    }

    const { data: memory, error } = await admin
      .from('memories')
      .select('id, title, body, kind, user_id')
      .eq('id', parsed.data.memory_id)
      .eq('user_id', userId)
      .single();
    if (error || !memory) return fail('Memory not found', 404);

    const text = `${memory.kind}: ${memory.title}\n${memory.body}`;
    const embedding = await embedText(text);

    const { error: upsertErr } = await admin.from('memory_embeddings').upsert(
      {
        memory_id: memory.id,
        embedding: JSON.stringify(embedding),
      },
      { onConflict: 'memory_id' },
    );
    if (upsertErr) return fail(upsertErr.message, 500);

    return json({ ok: true, memory_id: memory.id, dimensions: embedding.length });
  } catch (err) {
    if (err instanceof AuthError) return fail(err.message, 401);
    if (err instanceof GeminiError) return json({ error: err.message }, 502);
    return json({ error: err instanceof Error ? err.message : 'Unknown error' }, 500);
  }
});
