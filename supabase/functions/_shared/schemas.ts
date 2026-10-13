/**
 * Zod schemas for AI output validation inside Edge Functions.
 * Mirrors lib/gemini/schemas.ts (kept in sync manually: Deno vs bundler).
 * Rule: any AI output that fails these schemas is rejected outright.
 */
import { z } from 'npm:zod@3.24.1';

export const CaptureResultSchema = z
  .object({
    type: z.enum([
      'task',
      'event',
      'career_opportunity',
      'note',
      'memory',
      'reminder',
      'unknown',
    ]),
    title: z.string().optional(),
    description: z.string().optional(),
    priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
    due_at: z.string().nullable().optional(),
    start_at: z.string().nullable().optional(),
    end_at: z.string().nullable().optional(),
    timezone: z.string().optional(),
    location: z.string().nullable().optional(),
    organizer: z.string().nullable().optional(),
    company: z.string().optional(),
    role: z.string().optional(),
    opportunity_type: z
      .enum(['internship', 'full_time', 'part_time', 'contract'])
      .nullable()
      .optional(),
    work_mode: z.enum(['remote', 'hybrid', 'onsite']).nullable().optional(),
    deadline_at: z.string().nullable().optional(),
    url: z.string().nullable().optional(),
    requirements: z.array(z.string()).optional(),
    body: z.string().optional(),
    kind: z.enum(['decision', 'lesson', 'preference', 'fact', 'experience']).optional(),
    remind_at: z.string().nullable().optional(),
    area_hint: z.string().nullable().optional(),
    project_hint: z.string().nullable().optional(),
    reason: z.string().optional(),
    confidence: z.record(z.string(), z.number()).optional(),
  })
  .superRefine((val, ctx) => {
    if (val.type === 'event') {
      if (!val.title) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['title'], message: 'event requires title' });
      if (!val.start_at) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['start_at'], message: 'event requires start_at' });
      if (!val.end_at) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['end_at'], message: 'event requires end_at' });
    }
    if (val.type === 'task' && !val.title) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['title'], message: 'task requires title' });
    }
    if (val.type === 'career_opportunity') {
      if (!val.company) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['company'], message: 'company required' });
      if (!val.role) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['role'], message: 'role required' });
    }
    if (val.type === 'memory') {
      if (!val.kind) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['kind'], message: 'kind required' });
      if (!val.title) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['title'], message: 'title required' });
    }
    if (val.type === 'reminder' && !val.remind_at) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['remind_at'], message: 'remind_at required' });
    }
    if (val.type === 'unknown' && !val.reason) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['reason'], message: 'reason required' });
    }
  });

export type CaptureExtraction = z.infer<typeof CaptureResultSchema>;

/** Clamp + fill confidences for the fields we display. */
export function normalizeConfidence(
  raw: Record<string, number> | undefined,
  fields: string[],
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const f of fields) {
    const v = raw?.[f];
    out[f] = typeof v === 'number' && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0.5;
  }
  return out;
}

/** The JSON schema handed to Gemini (subset it supports). */
export const CAPTURE_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    type: {
      type: 'STRING',
      enum: [
        'task',
        'event',
        'career_opportunity',
        'note',
        'memory',
        'reminder',
        'unknown',
      ],
    },
    title: { type: 'STRING', nullable: true },
    description: { type: 'STRING', nullable: true },
    priority: { type: 'STRING', enum: ['low', 'medium', 'high', 'urgent'], nullable: true },
    due_at: { type: 'STRING', nullable: true },
    start_at: { type: 'STRING', nullable: true },
    end_at: { type: 'STRING', nullable: true },
    timezone: { type: 'STRING', nullable: true },
    location: { type: 'STRING', nullable: true },
    organizer: { type: 'STRING', nullable: true },
    company: { type: 'STRING', nullable: true },
    role: { type: 'STRING', nullable: true },
    opportunity_type: {
      type: 'STRING',
      enum: ['internship', 'full_time', 'part_time', 'contract'],
      nullable: true,
    },
    work_mode: { type: 'STRING', enum: ['remote', 'hybrid', 'onsite'], nullable: true },
    deadline_at: { type: 'STRING', nullable: true },
    url: { type: 'STRING', nullable: true },
    requirements: { type: 'ARRAY', items: { type: 'STRING' }, nullable: true },
    body: { type: 'STRING', nullable: true },
    kind: {
      type: 'STRING',
      enum: ['decision', 'lesson', 'preference', 'fact', 'experience'],
      nullable: true,
    },
    remind_at: { type: 'STRING', nullable: true },
    area_hint: { type: 'STRING', nullable: true },
    project_hint: { type: 'STRING', nullable: true },
    reason: { type: 'STRING', nullable: true },
    confidence: {
      type: 'OBJECT',
      properties: {
        title: { type: 'NUMBER' },
        date: { type: 'NUMBER' },
        time: { type: 'NUMBER' },
        location: { type: 'NUMBER' },
        organizer: { type: 'NUMBER' },
        description: { type: 'NUMBER' },
        company: { type: 'NUMBER' },
        role: { type: 'NUMBER' },
        body: { type: 'NUMBER' },
        kind: { type: 'NUMBER' },
        url: { type: 'NUMBER' },
        reason: { type: 'NUMBER' },
      },
    },
  },
  required: ['type'],
} as const;
