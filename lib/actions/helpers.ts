/**
 * Shared server-action helpers: auth gate, audit writes, revalidation.
 */
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/lib/supabase/types';

export class ActionError extends Error {
  constructor(message: string, public readonly field?: string) {
    super(message);
    this.name = 'ActionError';
  }
}

/** Returns the authenticated user's id or redirects to /login. */
export async function requireUser(): Promise<{ id: string }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  return { id: user.id };
}

/** Supabase client + user id, for actions that need both. */
export async function requireContext(): Promise<{
  supabase: SupabaseClient<Database>;
  userId: string;
}> {
  const user = await requireUser();
  return { supabase: createClient() as SupabaseClient<Database>, userId: user.id };
}

/** Format a ZodError (or unknown) into a single user-facing message. */
export function errorMessage(err: unknown): string {
  if (err instanceof ActionError) return err.message;
  if (err && typeof err === 'object' && 'issues' in err) {
    const issues = (err as { issues: { path: (string | number)[]; message: string }[] }).issues;
    return issues.map((i) => `${i.path.join('.') || 'form'}: ${i.message}`).join('; ');
  }
  if (err instanceof Error) return err.message;
  return 'Something went wrong';
}

/** Best-effort audit write (never throws into the request path). */
export async function audit(
  supabase: SupabaseClient<Database>,
  userId: string,
  entry: {
    action: string;
    entity_type: string;
    entity_id?: string | null;
    source?: 'user' | 'ai' | 'system';
    ai_run_id?: string | null;
    payload?: unknown;
  },
): Promise<void> {
  try {
    await supabase.from('audit_logs').insert({
      user_id: userId,
      action: entry.action,
      entity_type: entry.entity_type,
      entity_id: entry.entity_id ?? null,
      source: entry.source ?? 'user',
      ai_run_id: entry.ai_run_id ?? null,
      payload: (entry.payload ?? {}) as Record<string, never>,
    });
  } catch {
    // Auditing must never break the primary operation.
  }
}

export function revalidateApp(paths: string[] = ['/dashboard', '/inbox']) {
  for (const p of paths) revalidatePath(p);
}
