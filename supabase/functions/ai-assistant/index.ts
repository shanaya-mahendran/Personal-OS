/**
 * /ai-assistant — function-calling assistant (spec §5.5).
 *
 * mode: 'chat'       → Gemini answers or returns a tool PROPOSAL (not executed)
 * mode: 'summarize'  → Gemini summarizes a tool result the server already ran
 *
 * AI NEVER writes to the database here. Mutating proposals are returned to
 * the client as preview cards; only the confirmed server action executes them.
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
import { generateContent, GeminiError } from '../_shared/gemini.ts';
import { toolDeclarations, MUTATING_TOOLS, isMutating } from '../_shared/tools.ts';
import { ASSISTANT_SYSTEM_PROMPT, fill } from '../_shared/prompts.ts';

interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }});

  const started = Date.now();
  try {
    const userId = await requireUser(req);
    const body = (await req.json()) as {
      mode?: string;
      message?: string;
      history?: ChatTurn[];
      tool_name?: string;
      tool_result?: unknown;
    };

    const admin = await adminClient();
    if (!(await checkRateLimit(admin, userId, 'ai-assistant'))) {
      return json({ error: 'Rate limit: 30 AI calls per hour' }, 429);
    }

    const system = fill(ASSISTANT_SYSTEM_PROMPT, new Date().toISOString(), DEFAULT_TZ);
    const message = (body.message ?? '').slice(0, 8000);

    if (body.mode === 'summarize') {
      const result = await generateContent({
        system,
        contents: [
          ...(body.history ?? []).slice(-10).map((t) => ({
            role: t.role === 'assistant' ? ('model' as const) : ('user' as const),
            parts: [{ text: t.content }],
          })),
          { role: 'user' as const, parts: [{ text: message }] },
          {
            role: 'user' as const,
            parts: [
              {
                text: `Tool result from ${body.tool_name ?? 'tool'}:\n${JSON.stringify(body.tool_result ?? null).slice(0, 6000)}\n\nAnswer the user's request using this data. If it contains schedule items, present them as a compact list with times.`,
              },
            ],
          },
        ],
      });
      await logAiRun(admin, userId, {
        function_name: 'ai-assistant',
        latency_ms: Date.now() - started,
        status: 'ok',
        prompt_tokens: result.promptTokens,
        completion_tokens: result.completionTokens,
      });
      return json({ reply: result.text.trim() });
    }

    // mode: chat
    const contents = [
      ...(body.history ?? []).slice(-20).map((t) => ({
        role: t.role === 'assistant' ? ('model' as const) : ('user' as const),
        parts: [{ text: t.content }],
      })),
      { role: 'user' as const, parts: [{ text: message }] },
    ];

    const result = await generateContent({
      system,
      contents,
      tools: toolDeclarations(),
    });

    await logAiRun(admin, userId, {
      function_name: 'ai-assistant',
      latency_ms: Date.now() - started,
      status: 'ok',
      prompt_tokens: result.promptTokens,
      completion_tokens: result.completionTokens,
    });

    if (result.toolCalls.length > 0) {
      const call = result.toolCalls[0]!;
      if (!MUTATING_TOOLS.has(call.name)) {
        // Return even read-only calls: the SERVER action executes them so the
        // edge function itself never touches user rows with Gemini output.
        return json({ reply: result.text.trim(), proposal: { name: call.name, args: call.args } });
      }
      if (!isMutating(call.name)) return fail('Unknown tool', 422);
      return json({ reply: result.text.trim(), proposal: { name: call.name, args: call.args } });
    }

    return json({ reply: result.text.trim() });
  } catch (err) {
    if (err instanceof AuthError) return fail(err.message, 401);
    const message =
      err instanceof GeminiError ? err.message : err instanceof Error ? err.message : 'Unknown error';
    return json({ error: message }, 500);
  }
});
