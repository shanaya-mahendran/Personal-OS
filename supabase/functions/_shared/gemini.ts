/**
 * Deno-side Gemini client (fetch-based, mirrors lib/gemini/client.ts).
 * GEMINI_API_KEY comes exclusively from Edge Function secrets.
 */
import { GEMINI_API_KEY } from './env.ts';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';

export interface GeminiPart {
  text?: string;
  inlineData?: { mimeType: string; data: string };
}

export interface GeminiContent {
  role: 'user' | 'model';
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

export interface GenerateOptions {
  model?: string;
  system: string;
  contents: GeminiContent[];
  responseSchema?: Record<string, unknown>;
  tools?: FunctionDeclaration[];
  temperature?: number;
}

export interface GeminiResult {
  text: string;
  toolCalls: ToolCall[];
  promptTokens?: number;
  completionTokens?: number;
}

export class GeminiError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = 'GeminiError';
  }
}

export async function generateContent(options: GenerateOptions): Promise<GeminiResult> {
  if (!GEMINI_API_KEY) throw new GeminiError('GEMINI_API_KEY is not configured', 500);
  const model = options.model ?? 'gemini-2.0-flash';

  const body: Record<string, unknown> = {
    systemInstruction: { parts: [{ text: options.system }] },
    contents: options.contents,
    generationConfig: {
      temperature: options.temperature ?? 0.2,
      ...(options.responseSchema && !options.tools
        ? {
            responseMimeType: 'application/json',
            responseSchema: options.responseSchema,
          }
        : {}),
    },
    ...(options.tools && options.tools.length > 0
      ? { tools: [{ functionDeclarations: options.tools }] }
      : {}),
  };

  const res = await fetch(`${GEMINI_BASE}/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new GeminiError(`Gemini ${res.status}: ${detail.slice(0, 400)}`, res.status);
  }

  const json = (await res.json()) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{ text?: string; functionCall?: { name: string; args: Record<string, unknown> } }>;
      };
    }>;
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
  };

  const parts = json.candidates?.[0]?.content?.parts ?? [];
  const text = parts.map((p) => p.text ?? '').join('');
  const toolCalls: ToolCall[] = parts
    .filter((p) => Boolean(p.functionCall))
    .map((p) => ({ name: p.functionCall!.name, args: p.functionCall!.args ?? {} }));

  return {
    text,
    toolCalls,
    promptTokens: json.usageMetadata?.promptTokenCount,
    completionTokens: json.usageMetadata?.candidatesTokenCount,
  };
}

/** text-embedding-004 → 768 dims. */
export async function embedText(text: string): Promise<number[]> {
  if (!GEMINI_API_KEY) throw new GeminiError('GEMINI_API_KEY is not configured', 500);
  const res = await fetch(`${GEMINI_BASE}/models/text-embedding-004:embedContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY },
    body: JSON.stringify({
      model: 'models/text-embedding-004',
      content: { parts: [{ text: text.slice(0, 30000) }] },
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new GeminiError(`Gemini embed ${res.status}: ${detail.slice(0, 300)}`, res.status);
  }
  const json = (await res.json()) as { embedding?: { values?: number[] } };
  const values = json.embedding?.values;
  if (!values || values.length === 0) throw new GeminiError('Empty embedding');
  return values;
}

/** Parse JSON out of a reply, tolerating code fences. */
export function parseJson<T>(text: string): T {
  const stripped = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const start = stripped.indexOf('{');
  const arrStart = stripped.indexOf('[');
  const first = start === -1 ? arrStart : arrStart === -1 ? start : Math.min(start, arrStart);
  return JSON.parse(first === -1 ? stripped : stripped.slice(first)) as T;
}
