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
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'GeminiError';
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

/**
 * Low-level generateContent call.
 * When `tools` are provided the model may answer with function calls instead
 * of text; both are surfaced to the caller.
 */
export async function generateContent(
  options: GenerateOptions,
  fetchImpl: typeof fetch = fetch,
): Promise<GeminiResponse> {
  const model = options.model ?? 'gemini-2.0-flash';
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

/** text-embedding-004 → 768-dim vector. */
export async function embedContent(
  text: string,
  fetchImpl: typeof fetch = fetch,
): Promise<number[]> {
  const model = 'text-embedding-004';
  const res = await fetchImpl(
    `${GEMINI_BASE}/models/${model}:embedContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey() },
      body: JSON.stringify({
        model: `models/${model}`,
        content: { parts: [{ text: text.slice(0, 30000) }] },
      }),
    },
  );
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new GeminiError(`Gemini embed ${res.status}: ${detail.slice(0, 300)}`, res.status);
  }
  const json = (await res.json()) as {
    embedding?: { values?: number[] };
  };
  const values = json.embedding?.values;
  if (!values || values.length === 0) throw new GeminiError('Empty embedding response');
  return values;
}
