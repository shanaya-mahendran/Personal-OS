/**
 * Shared Edge Function helpers: environment, CORS, JWT verification.
 *
 * Security rules (spec §16):
 * - GEMINI_API_KEY and SUPABASE_SERVICE_ROLE_KEY live only here.
 * - Every request must carry `Authorization: Bearer <user JWT>`; user_id is
 *   DERIVED from the token — never trusted from the request body.
 */

export const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
export const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
export const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
export const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') ?? '';
export const DEFAULT_TZ = 'Asia/Colombo';

export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

export function fail(message: string, status = 400): Response {
  return json({ error: message }, status);
}

/** Extract the caller's user id from the Bearer JWT (never from the body). */
export async function requireUser(req: Request): Promise<string> {
  const header = req.headers.get('Authorization') ?? '';
  const token = header.replace(/^Bearer\s+/i, '');
  if (!token) throw new AuthError('Missing Authorization header');

  const { createClient } = await import('npm:@supabase/supabase-js@2');
  const anon = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data, error } = await anon.auth.getUser(token);
  if (error || !data.user) throw new AuthError('Invalid or expired token');
  return data.user.id;
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

/** Admin client (service role) — server-side only. */
export async function adminClient() {
  const { createClient } = await import('npm:@supabase/supabase-js@2');
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Record an ai_runs row for rate limiting + observability (spec §5.7). */
export async function logAiRun(
  admin: Awaited<ReturnType<typeof adminClient>>,
  userId: string,
  entry: {
    function_name: string;
    model?: string;
    latency_ms: number;
    status: 'ok' | 'error';
    error?: string;
    prompt_tokens?: number;
    completion_tokens?: number;
  },
): Promise<void> {
  await admin.from('ai_runs').insert({
    user_id: userId,
    function_name: entry.function_name,
    model: entry.model ?? 'gemini-2.0-flash',
    latency_ms: entry.latency_ms,
    status: entry.status,
    error: entry.error ?? null,
    prompt_tokens: entry.prompt_tokens ?? null,
    completion_tokens: entry.completion_tokens ?? null,
  });
}

/** 30 AI calls per user per hour (counted from ai_runs). */
export async function checkRateLimit(
  admin: Awaited<ReturnType<typeof adminClient>>,
  userId: string,
  functionName: string,
): Promise<boolean> {
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await admin
    .from('ai_runs')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('function_name', functionName)
    .gte('created_at', since);
  return (count ?? 0) < 30;
}
