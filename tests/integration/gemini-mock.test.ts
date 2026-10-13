/**
 * Integration-style tests: Gemini client against a mocked HTTP layer,
 * exercising the full request → response → schema-validation pipeline that
 * the /process-capture Edge Function performs (spec §20).
 *
 * These run offline; the live Supabase test-instance variant runs in CI.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { generateContent, embedContent, parseJsonText, GeminiError } from '@/lib/gemini/client';
import { CaptureResultSchema } from '@/lib/gemini/schemas';
import { CAPTURE_SYSTEM_PROMPT, fillPrompt } from '@/lib/gemini/prompts';

const originalFetch = globalThis.fetch;

class MockFetch {
  calls: { url: string; init?: RequestInit }[] = [];
  responder: (url: string, init?: RequestInit) => Response;

  constructor(responder: (url: string, init?: RequestInit) => Response) {
    this.responder = responder;
  }

  get impl(): typeof fetch {
    return ((url: RequestInfo | URL, init?: RequestInit) => {
      this.calls.push({ url: String(url), init });
      return Promise.resolve(this.responder(String(url), init));
    }) as typeof fetch;
  }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('process-capture pipeline (mocked Gemini)', () => {
  beforeEach(() => {
    process.env.GEMINI_API_KEY = 'test-key';
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('sends system instruction + schema and parses a structured extraction', async () => {
    const mock = new MockFetch(() =>
      jsonResponse({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    type: 'task',
                    title: 'Submit COS201 assignment',
                    priority: 'high',
                    due_at: '2026-05-08T23:59:00+05:30',
                    area_hint: 'University',
                    project_hint: null,
                    confidence: { title: 0.97, date: 0.92 },
                  }),
                },
              ],
            },
          },
        ],
        usageMetadata: { promptTokenCount: 210, candidatesTokenCount: 80 },
      }),
    );
    globalThis.fetch = mock.impl;

    const system = fillPrompt(CAPTURE_SYSTEM_PROMPT, {
      iso_now: '2026-05-04T10:00:00+05:30',
      tz: 'Asia/Colombo',
    });
    const result = await generateContent(
      {
        system,
        contents: [{ role: 'user', parts: [{ text: 'submit cos201 by friday night' }] }],
        responseSchema: { type: 'OBJECT' },
      },
      mock.impl,
    );

    // Request shape: auth header + system instruction, no key in the body.
    expect(mock.calls).toHaveLength(1);
    const init = mock.calls[0]!.init;
    const headers = init?.headers as Record<string, string>;
    expect(headers['x-goog-api-key']).toBe('test-key');
    const body = JSON.parse(String(init?.body)) as {
      systemInstruction: { parts: { text: string }[] };
      generationConfig: { responseMimeType: string };
    };
    expect(body.systemInstruction.parts[0]!.text).toContain('Current date/time is 2026-05-04');
    expect(body.systemInstruction.parts[0]!.text).toContain('Asia/Colombo');
    expect(body.generationConfig.responseMimeType).toBe('application/json');

    // Response parses and passes Zod (the exact gate the edge function uses).
    const parsed = CaptureResultSchema.safeParse(parseJsonText<unknown>(result.text));
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.type).toBe('task');
    expect(result.promptTokens).toBe(210);
  });

  it('rejects AI output that fails the schema (never stored)', async () => {
    const mock = new MockFetch(() =>
      jsonResponse({
        candidates: [{ content: { parts: [{ text: '{"type":"event","title":"missing times"}' }] } }],
      }),
    );
    globalThis.fetch = mock.impl;

    const result = await generateContent(
      {
        system: 'sys',
        contents: [{ role: 'user', parts: [{ text: 'x' }] }],
      },
      mock.impl,
    );
    const parsed = CaptureResultSchema.safeParse(parseJsonText<unknown>(result.text));
    expect(parsed.success).toBe(false);
  });

  it('returns tool calls when Gemini proposes a function', async () => {
    const mock = new MockFetch(() =>
      jsonResponse({
        candidates: [
          {
            content: {
              parts: [
                {
                  functionCall: {
                    name: 'create_task',
                    args: { title: 'From assistant', priority: 'medium' },
                  },
                },
              ],
            },
          },
        ],
      }),
    );
    globalThis.fetch = mock.impl;

    const result = await generateContent(
      {
        system: 'sys',
        contents: [{ role: 'user', parts: [{ text: 'make a task' }] }],
        tools: [
          {
            name: 'create_task',
            description: 'Create a task',
            parameters: { type: 'object', properties: {} },
          },
        ],
      },
      mock.impl,
    );
    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0]!.name).toBe('create_task');
    expect(result.toolCalls[0]!.args).toMatchObject({ title: 'From assistant' });
  });

  it('surfaces Gemini HTTP errors', async () => {
    const mock = new MockFetch(() => new Response('quota exceeded', { status: 429 }));
    globalThis.fetch = mock.impl;

    await expect(
      generateContent(
        { system: 's', contents: [{ role: 'user', parts: [{ text: 'x' }] }] },
        mock.impl,
      ),
    ).rejects.toBeInstanceOf(GeminiError);
  });

  it('embeds text into a 768-dim vector', async () => {
    const mock = new MockFetch(() =>
      jsonResponse({ embedding: { values: Array.from({ length: 768 }, (_, i) => i / 768) } }),
    );
    globalThis.fetch = mock.impl;

    const values = await embedContent('I decided to prioritize backend roles', mock.impl);
    expect(values).toHaveLength(768);
    const body = JSON.parse(String(mock.calls[0]!.init?.body)) as { model: string };
    expect(['models/gemini-embedding-001', 'models/text-embedding-004']).toContain(body.model);
  });
});
