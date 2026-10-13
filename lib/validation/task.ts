import { z } from 'zod';

export const TaskStatusSchema = z.enum(['todo', 'in_progress', 'done', 'cancelled']);
export const TaskPrioritySchema = z.enum(['low', 'medium', 'high', 'urgent']);

/** RRULE subset: we store the string and expand client-side (spec §11). */
export const RRuleSchema = z
  .string()
  .regex(
    /^RRULE:(FREQ=(DAILY|WEEKLY|MONTHLY|YEARLY)(;INTERVAL=\d+)?(;BYDAY=(-?MO|-?TU|-?WE|-?TH|-?FR|-?SA|-?SU)(,-?MO|-?TU|-?WE|-?TH|-?FR|-?SA|-?SU)*)?(;COUNT=\d+)?(;UNTIL=\d{8}T\d{6}Z)?)$/,
    'Must be an RRULE like RRULE:FREQ=WEEKLY;BYDAY=MO',
  );

export const TaskCreateSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(300),
  description: z.string().max(5000).optional(),
  project_id: z.string().uuid().nullable().optional(),
  area_id: z.string().uuid().nullable().optional(),
  priority: TaskPrioritySchema.default('medium'),
  due_at: z
    .union([z.string().datetime({ offset: true }), z.string().date(), z.literal('')])
    .nullable()
    .optional()
    .transform((v) => (v === '' || v === undefined ? null : v)),
  reminder_at: z.string().datetime({ offset: true }).nullable().optional(),
  recurrence_rule: RRuleSchema.nullable().optional(),
  source_capture_id: z.string().uuid().nullable().optional(),
});

export const TaskUpdateSchema = TaskCreateSchema.partial()
  .extend({ id: z.string().uuid() })
  .extend({ status: TaskStatusSchema.optional() });

export type TaskCreate = z.infer<typeof TaskCreateSchema>;
export type TaskUpdate = z.infer<typeof TaskUpdateSchema>;

/** Toggle completion, keeping completed_at consistent. */
export function completionFields(status: string): {
  status: 'todo' | 'done';
  completed_at: string | null;
} {
  if (status === 'done') return { status: 'done', completed_at: new Date().toISOString() };
  return { status: 'todo', completed_at: null };
}

export const ProjectCreateSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(300),
  description: z.string().max(5000).optional(),
  goal: z.string().max(5000).optional(),
  area_id: z.string().uuid().nullable().optional(),
  status: z.enum(['active', 'paused', 'done', 'archived']).default('active'),
  deadline_at: z.string().datetime({ offset: true }).nullable().optional(),
  next_action: z.string().max(300).nullable().optional(),
});

export type ProjectCreate = z.infer<typeof ProjectCreateSchema>;
