'use server';

/**
 * Memory actions: create (with embedding) + semantic search (pgvector).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { MemoryCreateSchema } from '@/lib/validation/career';
import type { Database, MemoryRow } from '@/lib/supabase/types';
import { ActionError, audit, errorMessage, requireContext } from './helpers';

export interface MemoryActionResult<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}

export interface SearchHit extends MemoryRow {
  similarity: number;
}

/** Create a memory, then kick off embedding generation. */
export async function createMemory(input: unknown): Promise<
  MemoryActionResult<{ id: string }>
> {
  try {
    const parsed = MemoryCreateSchema.parse(input);
    const { supabase, userId } = await requireContext();

    const { data, error } = await supabase
      .from('memories')
      .insert({ ...parsed, user_id: userId })
      .select('id')
      .single();
    if (error) throw new ActionError(error.message);

    // Ask the Edge Function to embed it (GEMINI_API_KEY stays server-side).
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) {
        void supabase.functions.invoke('generate-embedding', {
          body: { memory_id: data.id },
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
      }
    } catch {
      // Embedding is asynchronous; the memory itself is already saved.
    }

    await audit(supabase, userId, {
      action: 'create',
      entity_type: 'memory',
      entity_id: data.id,
      payload: { kind: parsed.kind },
    });
    return { ok: true, data: { id: data.id } };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

async function embedQuery(
  supabase: SupabaseClient<Database>,
  text: string,
): Promise<number[] | null> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return null;
    const res = await supabase.functions.invoke('generate-embedding', {
      body: { text },
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (res.error) return null;
    const embedding = (res.data as { embedding?: number[] })?.embedding;
    return Array.isArray(embedding) ? embedding : null;
  } catch {
    return null;
  }
}

/**
 * Semantic search. Uses pgvector cosine similarity when an embedding is
 * available, and falls back to the SQL text search so the UI still answers.
 */
export async function searchMemories(query: string): Promise<
  MemoryActionResult<{ hits: SearchHit[]; mode: 'vector' | 'text' }>
> {
  try {
    const q = query.trim();
    if (!q) return { ok: true, data: { hits: [], mode: 'text' } };
    const { supabase } = await requireContext();

    const embedding = await embedQuery(supabase, q);
    if (embedding) {
      const { data, error } = await supabase.rpc('match_memories', {
        query_embedding: embedding,
        match_count: 10,
      });
      if (!error && data) {
        return { ok: true, data: { hits: data as SearchHit[], mode: 'vector' } };
      }
    }

    const { data, error } = await supabase.rpc('search_memories_text', {
      query_text: q,
      match_count: 10,
    });
    if (error) throw new ActionError(error.message);
    return { ok: true, data: { hits: (data ?? []) as SearchHit[], mode: 'text' } };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

export async function deleteMemory(id: string): Promise<MemoryActionResult> {
  try {
    const { supabase, userId } = await requireContext();
    const { error } = await supabase.from('memories').delete().eq('id', id).eq('user_id', userId);
    if (error) throw new ActionError(error.message);
    await audit(supabase, userId, { action: 'delete', entity_type: 'memory', entity_id: id });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}
