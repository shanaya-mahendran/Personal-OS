/**
 * Zod schema for Gemini structured capture extraction.
 * Every AI response MUST parse through this before touching the database.
 */
import { z } from 'zod';

export const CaptureResultSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('task'),
    title: z.string().min(1),
    description: z.string().optional(),
    priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
    due_at: z.string().datetime({ offset: true }).nullable().optional(),
    area_hint: z.string().nullable().optional(),
    project_hint: z.string().nullable().optional(),
  }),
  z.object({
    type: z.literal('event'),
    title: z.string().min(1),
    description: z.string().optional(),
    start_at: z.string().datetime({ offset: true }),
    end_at: z.string().datetime({ offset: true }),
    timezone: z.string().default('Asia/Colombo'),
    location: z.string().nullable().optional(),
    organizer: z.string().nullable().optional(),
    topics: z.array(z.string()).optional(),
  }),
  z.object({
    type: z.literal('career_opportunity'),
    company: z.string().min(1),
    role: z.string().min(1),
    /** The career "type" column can't share a key with the discriminator. */
    opportunity_type: z.enum(['internship', 'full_time', 'part_time', 'contract']).nullable().optional(),
    location: z.string().nullable().optional(),
    work_mode: z.enum(['remote', 'hybrid', 'onsite']).nullable().optional(),
    deadline_at: z.string().datetime({ offset: true }).nullable().optional(),
    url: z
      .string()
      .url()
      .nullable()
      .optional()
      .or(z.literal('').transform(() => null)),
    requirements: z.array(z.string()).optional(),
  }),
  z.object({
    type: z.literal('note'),
    title: z.string().min(1),
    body: z.string(),
  }),
  z.object({
    type: z.literal('memory'),
    kind: z.enum(['decision', 'lesson', 'preference', 'fact', 'experience']),
    title: z.string().min(1),
    body: z.string(),
  }),
  z.object({
    type: z.literal('reminder'),
    title: z.string().min(1),
    remind_at: z.string().datetime({ offset: true }),
  }),
  z.object({
    type: z.literal('unknown'),
    reason: z.string(),
  }),
]);

export type CaptureResult = z.infer<typeof CaptureResultSchema>;

/** Per-field confidence map, all values clamped to [0, 1]. */
export const ConfidenceSchema = z
  .record(z.string(), z.number())
  .transform((rec) =>
    Object.fromEntries(
      Object.entries(rec).map(([k, v]) => [
        k,
        Math.min(1, Math.max(0, v)),
      ]),
    ),
);

export type ConfidenceMap = z.infer<typeof ConfidenceSchema>;

/** Threshold below which the UI highlights a field in amber. */
export const LOW_CONFIDENCE = 0.75;
/** Design-doc threshold for the "Check this" nudge. */
export const NUDGE_CONFIDENCE = 0.85;

export function isLowConfidence(value: number | undefined): boolean {
  return typeof value === 'number' && value < LOW_CONFIDENCE;
}
