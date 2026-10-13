import { describe, expect, it } from 'vitest';
import { TOOL_NAMES, TOOL_SCHEMAS, MUTATING_TOOLS, READ_ONLY_TOOLS, zodToJsonSchema, toolDeclarations } from '@/lib/ai/functions';
import { executeTool, ExecutorError, AI_RATE_LIMIT } from '@/lib/ai/executor';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';

const fakeClient = {} as SupabaseClient<Database>;

describe('tool registry safety', () => {
  it('has no delete tool', () => {
    expect(TOOL_NAMES.some((n) => n.startsWith('delete'))).toBe(false);
  });

  it('partitions mutating vs read-only tools', () => {
    expect(MUTATING_TOOLS.has('create_task')).toBe(true);
    expect(MUTATING_TOOLS.has('create_event')).toBe(true);
    expect(READ_ONLY_TOOLS.has('get_schedule')).toBe(true);
    expect(READ_ONLY_TOOLS.has('search_memory')).toBe(true);
    for (const name of READ_ONLY_TOOLS) expect(MUTATING_TOOLS.has(name)).toBe(false);
  });

  it('rate-limits to 30 per hour', () => {
    expect(AI_RATE_LIMIT).toBe(30);
  });

  it('every tool has a schema', () => {
    for (const name of TOOL_NAMES) {
      expect(TOOL_SCHEMAS[name]).toBeDefined();
    }
  });

  it('produces JSON-schema declarations for Gemini', () => {
    const decls = toolDeclarations();
    expect(decls).toHaveLength(TOOL_NAMES.length);
    const createTask = decls.find((d) => d.name === 'create_task');
    expect(createTask?.parameters.type).toBe('object');
    expect((createTask?.parameters.required as string[]).includes('title')).toBe(true);
  });
});

describe('zodToJsonSchema', () => {
  it('converts objects, enums, arrays, optionals', () => {
    const schema = TOOL_SCHEMAS.create_note;
    const json = zodToJsonSchema(schema);
    expect(json.type).toBe('object');
    const props = json.properties as Record<string, { type?: string }>;
    expect(props.title?.type).toBe('string');
    expect((json.required as string[]).includes('title')).toBe(true);
    expect((json.required as string[]).includes('tags')).toBe(false);
  });

  it('converts enums', () => {
    const json = zodToJsonSchema(TOOL_SCHEMAS.create_memory);
    const props = json.properties as Record<string, { enum?: string[] }>;
    expect(props.kind?.enum).toContain('decision');
  });
});

describe('executeTool', () => {
  it('returns a preview (no execution) for mutating tools without confirm', async () => {
    const result = await executeTool(fakeClient, {
      userId: 'u1',
      tool: 'create_task',
      args: { title: 'Preview me' },
      confirm: false,
    });
    expect(result.ok).toBe(true);
    expect(result.preview).toMatchObject({ title: 'Preview me' });
    expect(result.data).toBeUndefined();
  });

  it('rejects invalid arguments before touching the database', async () => {
    await expect(
      executeTool(fakeClient, {
        userId: 'u1',
        tool: 'create_task',
        args: { title: '' },
        confirm: true,
      }),
    ).rejects.toBeInstanceOf(ExecutorError);
  });

  it('rejects unknown tools', async () => {
    await expect(
      executeTool(fakeClient, {
        userId: 'u1',
        tool: 'drop_database',
        args: {},
        confirm: true,
      }),
    ).rejects.toThrow(/Unknown tool/);
  });
});
