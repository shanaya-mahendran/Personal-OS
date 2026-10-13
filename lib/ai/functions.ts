/**
 * AI tool registry.
 *
 * Declares every tool the assistant may propose, with a Zod schema per tool.
 * Tools are DECLARATIONS only on this module (safe to ship shapes to Gemini);
 * execution lives in executor.ts and always requires user confirmation.
 */
import { z } from 'zod';

export const TOOL_NAMES = [
  'create_task',
  'update_task',
  'create_event',
  'update_event',
  'create_project',
  'create_note',
  'create_memory',
  'create_reminder',
  'search_memory',
  'get_today',
  'get_schedule',
  'get_prayer_times',
  'get_day_context',
] as const;

export type ToolName = (typeof TOOL_NAMES)[number];

/** Mutation tools: these only ever produce a preview until confirmed. */
export const MUTATING_TOOLS = new Set<ToolName>([
  'create_task',
  'update_task',
  'create_event',
  'update_event',
  'create_project',
  'create_note',
  'create_memory',
  'create_reminder',
]);

/** Read-only tools: safe to execute immediately to answer a question. */
export const READ_ONLY_TOOLS = new Set<ToolName>([
  'search_memory',
  'get_today',
  'get_schedule',
  'get_prayer_times',
  'get_day_context',
]);

const taskShape = {
  title: z.string().min(1).max(300),
  description: z.string().max(5000).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  due_at: z.string().datetime({ offset: true }).nullable().optional(),
  area_id: z.string().uuid().nullable().optional(),
  project_id: z.string().uuid().nullable().optional(),
};

const eventShape = {
  title: z.string().min(1).max(300),
  description: z.string().max(5000).optional(),
  start_at: z.string().datetime({ offset: true }),
  end_at: z.string().datetime({ offset: true }),
  location: z.string().max(300).nullable().optional(),
  organizer: z.string().max(300).nullable().optional(),
  timezone: z.string().default('Asia/Colombo'),
};

export const TOOL_SCHEMAS = {
  create_task: z.object(taskShape),
  update_task: z
    .object({ id: z.string().uuid(), ...taskShape, status: z.enum(['todo', 'in_progress', 'done', 'cancelled']).optional() })
    .partial()
    .extend({ id: z.string().uuid() }),
  create_event: z.object(eventShape),
  update_event: z
    .object({ id: z.string().uuid(), ...eventShape })
    .partial()
    .extend({ id: z.string().uuid() }),
  create_project: z.object({
    title: z.string().min(1).max(300),
    description: z.string().max(5000).optional(),
    goal: z.string().max(5000).optional(),
    area_id: z.string().uuid().nullable().optional(),
    deadline_at: z.string().datetime({ offset: true }).nullable().optional(),
    next_action: z.string().max(300).nullable().optional(),
  }),
  create_note: z.object({
    title: z.string().min(1).max(300),
    body: z.string().max(20000),
    area_id: z.string().uuid().nullable().optional(),
    tags: z.array(z.string().max(50)).max(20).optional(),
  }),
  create_memory: z.object({
    kind: z.enum(['decision', 'lesson', 'preference', 'fact', 'experience']),
    title: z.string().min(1).max(300),
    body: z.string().max(20000),
  }),
  create_reminder: z.object({
    title: z.string().min(1).max(300),
    remind_at: z.string().datetime({ offset: true }),
  }),
  search_memory: z.object({ query: z.string().min(1).max(500), limit: z.number().int().min(1).max(20).default(10) }),
  get_today: z.object({}).strict(),
  get_schedule: z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    days: z.number().int().min(1).max(14).default(1),
  }),
  get_prayer_times: z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  }),
  get_day_context: z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    include_memories: z
      .boolean()
      .default(true)
      .optional(),
  }),
} satisfies Record<ToolName, z.ZodTypeAny>;

/** JSON declarations handed to Gemini's functionDeclarations. */
export function toolDeclarations(): {
  name: ToolName;
  description: string;
  parameters: Record<string, unknown>;
}[] {
  return TOOL_NAMES.map((name) => ({
    name,
    description: TOOL_DESCRIPTIONS[name],
    parameters: zodToJsonSchema(TOOL_SCHEMAS[name]),
  }));
}

const TOOL_DESCRIPTIONS: Record<ToolName, string> = {
  create_task: 'Create a to-do task for the user.',
  update_task: 'Update an existing task (status, due date, priority, title).',
  create_event: 'Create a calendar event with start/end times.',
  update_event: 'Update an existing calendar event.',
  create_project: 'Create a project with a goal and next action.',
  create_note: 'Save a note.',
  create_memory: 'Save a long-term memory of a decision, lesson, preference, fact, or experience.',
  create_reminder: 'Schedule a one-off reminder.',
  search_memory: 'Semantic search over the user long-term memories.',
  get_today: "List today's tasks and events.",
  get_schedule: 'List events for a date or range of days.',
  get_prayer_times: "Fetch the user's prayer schedule for a date.",
  get_day_context: "Build a concise read model of the user's day: current and upcoming events, open tasks, active projects, and optionally recent memories. Use this when the user asks what their day looks like.",
};

/**
 * Minimal Zod → JSON Schema conversion covering the subset we use
 * (objects, strings, numbers, enums, arrays, literals, datetimes).
 */
export function zodToJsonSchema(schema: z.ZodTypeAny): Record<string, unknown> {
  const def = schema._def;
  const description = def.description;

  switch (schema.constructor.name) {
    case 'ZodObject': {
      const shape = (schema as z.ZodObject<z.ZodRawShape>).shape;
      const properties: Record<string, unknown> = {};
      const required: string[] = [];
      for (const [key, value] of Object.entries(shape)) {
        properties[key] = zodToJsonSchema(value as z.ZodTypeAny);
        if (!(value as z.ZodTypeAny).isOptional()) required.push(key);
      }
      return {
        type: 'object',
        properties,
        ...(required.length ? { required } : {}),
        ...(description ? { description } : {}),
      };
    }
    case 'ZodString':
      return { type: 'string', ...(description ? { description } : {}) };
    case 'ZodNumber':
      return { type: 'number', ...(description ? { description } : {}) };
    case 'ZodBoolean':
      return { type: 'boolean', ...(description ? { description } : {}) };
    case 'ZodLiteral':
      return { type: typeof (def as { value: unknown }).value, enum: [(def as { value: unknown }).value] };
    case 'ZodEnum':
      return { type: 'string', enum: (def as { values: string[] }).values };
    case 'ZodArray':
      return {
        type: 'array',
        items: zodToJsonSchema((def as { type: z.ZodTypeAny }).type),
        ...(description ? { description } : {}),
      };
    case 'ZodNullable':
      return zodToJsonSchema((def as { innerType: z.ZodTypeAny }).innerType);
    case 'ZodOptional':
      return zodToJsonSchema((def as { innerType: z.ZodTypeAny }).innerType);
    case 'ZodDefault':
      return zodToJsonSchema((def as { innerType: z.ZodTypeAny }).innerType);
    case 'ZodEffects':
      return zodToJsonSchema((def as { schema: z.ZodTypeAny }).schema);
    case 'ZodRecord':
      return { type: 'object', additionalProperties: true };
    default:
      return { type: 'string' };
  }
}
