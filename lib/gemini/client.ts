/**
 * Server-only Gemini REST client.
 *
 * Uses plain `fetch` so the same implementation runs in Node (Next.js server)
 * and Deno (Supabase Edge Functions). The API key is read from
 * GEMINI_API_KEY, which lives only in Edge Function / server secrets.
 */

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';

export type GeminiRole = 'user' | 'model';

export interface GeminiPart {
  text?: string;
  inlineData?: { mimeType: string; data: string };
}

export interface GeminiContent {
  role: GeminiRole;
  parts: GeminiPart[];
}

export interface FunctionDeclaration {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface ToolCall {
  name: string;
  args: Record<string, unknown>;
}

export interface GeminiResponse {
  text: string;
  toolCalls: ToolCall[];
  promptTokens?: number;
  completionTokens?: number;
  raw: unknown;
}

export class GeminiError extends Error {
  public readonly status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'GeminiError';
    this.status = status;
  }
}

function apiKey(): string {
  const key = DenoCompatibleEnv.GEMINI_API_KEY ?? processEnv?.GEMINI_API_KEY;
  if (!key) throw new GeminiError('GEMINI_API_KEY is not configured');
  return key;
}

/** Works in both Node (process.env) and Deno (Deno.env). */
const processEnv =
  typeof process !== 'undefined' ? (process.env as Record<string, string | undefined>) : undefined;

const DenoCompatibleEnv = {
  get GEMINI_API_KEY(): string | undefined {
    const deno = (globalThis as { Deno?: { env?: { get(k: string): string | undefined } } }).Deno;
    if (deno?.env?.get) return deno.env.get('GEMINI_API_KEY');
    return processEnv?.GEMINI_API_KEY;
  },
};

export interface GenerateOptions {
  model?: string;
  system: string;
  contents: GeminiContent[];
  /** JSON schema for structured output (responseSchema). */
  responseSchema?: Record<string, unknown>;
  /** Function declarations for tool calling. */
  tools?: FunctionDeclaration[];
  temperature?: number;
  maxOutputTokens?: number;
}

const CANDIDATE_MODELS = [
  'gemini-3.1-flash-lite',
  'gemini-3.5-flash',
  'gemini-3.8-flash',
  'gemini-3-flash-preview',
  'gemini-3.5-flash-lite',
];

/**
 * Low-level generateContent call.
 * Automatically tries candidate models with fallback if a model experiences
 * transient 503 high demand spikes or deprecation.
 */
export async function generateContent(
  options: GenerateOptions,
  fetchImpl: typeof fetch = fetch,
): Promise<GeminiResponse> {
  const modelsToTry = options.model ? [options.model, ...CANDIDATE_MODELS.filter((m) => m !== options.model)] : CANDIDATE_MODELS;
  const body: Record<string, unknown> = {
    systemInstruction: { parts: [{ text: options.system }] },
    contents: options.contents,
    generationConfig: {
      temperature: options.temperature ?? 0.2,
      ...(options.maxOutputTokens ? { maxOutputTokens: options.maxOutputTokens } : {}),
      ...(options.responseSchema && !options.tools
        ? { responseMimeType: 'application/json', responseSchema: options.responseSchema }
        : {}),
    },
    ...(options.tools && options.tools.length > 0 ? { tools: [{ functionDeclarations: options.tools }] } : {}),
  };

  let lastError: Error | null = null;

  for (const model of modelsToTry) {
    try {
      const res = await fetchImpl(
        `${GEMINI_BASE}/models/${model}:generateContent`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey(),
          },
          body: JSON.stringify(body),
        },
      );

      if (!res.ok) {
        const detail = await res.text().catch(() => '');
        // If 503, 429, or 404, continue to next model in the candidate list
        if ([404, 429, 503].includes(res.status)) {
          lastError = new GeminiError(`Gemini ${model} ${res.status}: ${detail.slice(0, 300)}`, res.status);
          continue;
        }
        throw new GeminiError(`Gemini ${res.status}: ${detail.slice(0, 500)}`, res.status);
      }

      const json = (await res.json()) as {
        candidates?: Array<{
          content?: { parts?: Array<{ text?: string; functionCall?: { name: string; args: Record<string, unknown> } }> };
        }>;
        usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
      };

      const parts = json.candidates?.[0]?.content?.parts ?? [];
      const text = parts.map((p) => p.text ?? '').join('');
      const toolCalls: ToolCall[] = parts
        .filter((p): p is { functionCall: { name: string; args: Record<string, unknown> } } =>
          Boolean(p.functionCall))
        .map((p) => ({ name: p.functionCall.name, args: p.functionCall.args ?? {} }));

      return {
        text,
        toolCalls,
        promptTokens: json.usageMetadata?.promptTokenCount,
        completionTokens: json.usageMetadata?.candidatesTokenCount,
        raw: json,
      };
    } catch (err) {
      if (err instanceof GeminiError && err.status && ![404, 429, 503].includes(err.status)) {
        throw err;
      }
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  throw lastError ?? new GeminiError('All Gemini models unavailable');
}

/** Parse JSON out of a model reply, tolerating code fences. */
export function parseJsonText<T>(text: string): T {
  const stripped = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');
  const start = stripped.indexOf('{');
  const arrStart = stripped.indexOf('[');
  const first = start === -1 ? arrStart : arrStart === -1 ? start : Math.min(start, arrStart);
  const candidate = first === -1 ? stripped : stripped.slice(first);
  return JSON.parse(candidate) as T;
}

/** gemini-embedding-001 (or gemini-embedding-2) → 768-dim vector. */
export async function embedContent(
  text: string,
  fetchImpl: typeof fetch = fetch,
): Promise<number[]> {
  const models = ['gemini-embedding-001', 'gemini-embedding-2'];
  let lastErr: Error | null = null;
  for (const model of models) {
    try {
      const res = await fetchImpl(
        `${GEMINI_BASE}/models/${model}:embedContent`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey() },
          body: JSON.stringify({
            model: `models/${model}`,
            content: { parts: [{ text: text.slice(0, 30000) }] },
            outputDimensionality: 768,
          }),
        },
      );
      if (res.ok) {
        const json = (await res.json()) as { embedding?: { values?: number[] } };
        const values = json.embedding?.values;
        if (values && values.length > 0) return values;
      }
      const detail = await res.text().catch(() => '');
      lastErr = new GeminiError(`Gemini embed ${res.status}: ${detail.slice(0, 300)}`, res.status);
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
    }
  }
  throw lastErr ?? new GeminiError('Embedding failed');
}
