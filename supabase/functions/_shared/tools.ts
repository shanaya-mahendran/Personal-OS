/**
 * Tool declarations handed to Gemini (Deno copy of lib/ai/functions.ts,
 * expressed as plain JSON Schema — no zod dependency needed here).
 *
 * These are DECLARATIONS only: the edge function returns proposals; the
 * server action validates with Zod and executes after user confirmation.
 */

export const MUTATING_TOOLS = new Set([
  'create_task',
  'update_task',
  'create_event',
  'update_event',
  'create_project',
  'create_note',
  'create_memory',
  'create_reminder',
]);

export function isMutating(name: string): boolean {
  return MUTATING_TOOLS.has(name);
}

const dateTime = { type: 'STRING', description: 'ISO-8601 with offset, e.g. 2026-10-06T14:30:00+05:30' };

export function toolDeclarations(): {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}[] {
  return [
    {
      name: 'create_task',
      description: 'Create a to-do task for the user.',
      parameters: {
        type: 'OBJECT',
        properties: {
          title: { type: 'STRING' },
          description: { type: 'STRING' },
          priority: { type: 'STRING', enum: ['low', 'medium', 'high', 'urgent'] },
          due_at: { ...dateTime, nullable: true },
        },
        required: ['title'],
      },
    },
    {
      name: 'update_task',
      description: 'Update an existing task (status, due date, priority, title).',
      parameters: {
        type: 'OBJECT',
        properties: {
          id: { type: 'STRING', description: 'UUID of the task' },
          title: { type: 'STRING' },
          status: { type: 'STRING', enum: ['todo', 'in_progress', 'done', 'cancelled'] },
          priority: { type: 'STRING', enum: ['low', 'medium', 'high', 'urgent'] },
          due_at: { ...dateTime, nullable: true },
        },
        required: ['id'],
      },
    },
    {
      name: 'create_event',
      description: 'Create a calendar event with start/end times.',
      parameters: {
        type: 'OBJECT',
        properties: {
          title: { type: 'STRING' },
          description: { type: 'STRING' },
          start_at: dateTime,
          end_at: dateTime,
          location: { type: 'STRING', nullable: true },
          organizer: { type: 'STRING', nullable: true },
        },
        required: ['title', 'start_at', 'end_at'],
      },
    },
    {
      name: 'update_event',
      description: 'Update an existing calendar event.',
      parameters: {
        type: 'OBJECT',
        properties: {
          id: { type: 'STRING' },
          title: { type: 'STRING' },
          start_at: { ...dateTime, nullable: true },
          end_at: { ...dateTime, nullable: true },
          location: { type: 'STRING', nullable: true },
        },
        required: ['id'],
      },
    },
    {
      name: 'create_project',
      description: 'Create a project with a goal and next action.',
      parameters: {
        type: 'OBJECT',
        properties: {
          title: { type: 'STRING' },
          description: { type: 'STRING' },
          goal: { type: 'STRING' },
          next_action: { type: 'STRING', nullable: true },
          deadline_at: { ...dateTime, nullable: true },
        },
        required: ['title'],
      },
    },
    {
      name: 'create_note',
      description: 'Save a note.',
      parameters: {
        type: 'OBJECT',
        properties: {
          title: { type: 'STRING' },
          body: { type: 'STRING' },
        },
        required: ['title', 'body'],
      },
    },
    {
      name: 'create_memory',
      description:
        'Save a long-term memory of a decision, lesson, preference, fact, or experience.',
      parameters: {
        type: 'OBJECT',
        properties: {
          kind: {
            type: 'STRING',
            enum: ['decision', 'lesson', 'preference', 'fact', 'experience'],
          },
          title: { type: 'STRING' },
          body: { type: 'STRING' },
        },
        required: ['kind', 'title', 'body'],
      },
    },
    {
      name: 'create_reminder',
      description: 'Schedule a one-off reminder.',
      parameters: {
        type: 'OBJECT',
        properties: {
          title: { type: 'STRING' },
          remind_at: dateTime,
        },
        required: ['title', 'remind_at'],
      },
    },
    {
      name: 'search_memory',
      description: 'Search the user long-term memories by text.',
      parameters: {
        type: 'OBJECT',
        properties: {
          query: { type: 'STRING' },
          limit: { type: 'INTEGER' },
        },
        required: ['query'],
      },
    },
    {
      name: 'get_today',
      description: "List today's tasks and events.",
      parameters: { type: 'OBJECT', properties: {} },
    },
    {
      name: 'get_schedule',
      description: 'List events for a date or range of days.',
      parameters: {
        type: 'OBJECT',
        properties: {
          date: { type: 'STRING', description: 'YYYY-MM-DD, defaults to today' },
          days: { type: 'INTEGER' },
        },
      },
    },
    {
      name: 'get_prayer_times',
      description: "Fetch the user's prayer schedule for a date.",
      parameters: {
        type: 'OBJECT',
        properties: {
          date: { type: 'STRING', description: 'YYYY-MM-DD, defaults to today' },
        },
      },
    },
    {
      name: 'get_day_context',
      description: 'Build a concise read model of the user\'s day: current and upcoming events, open tasks, active projects, and optionally recent memories. Use this when the user asks what their day looks like.',
      parameters: {
        type: 'OBJECT',
        properties: {
          date: { type: 'STRING', description: 'YYYY-MM-DD, defaults to today' },
          include_memories: { type: 'BOOLEAN' },
        },
      },
    },
  ];
}
