import { z } from 'zod';

export const CareerStatusSchema = z.enum([
  'saved',
  'applied',
  'screening',
  'interview',
  'technical',
  'offer',
  'accepted',
  'rejected',
  'withdrawn',
]);

export const CareerTypeSchema = z.enum(['internship', 'full_time', 'part_time', 'contract']);
export const WorkModeSchema = z.enum(['remote', 'hybrid', 'onsite']);

export const OpportunityCreateSchema = z.object({
  company: z.string().trim().min(1, 'Company is required').max(200),
  role: z.string().trim().min(1, 'Role is required').max(200),
  type: CareerTypeSchema.nullable().optional(),
  location: z.string().max(200).nullable().optional(),
  work_mode: WorkModeSchema.nullable().optional(),
  salary: z.string().max(120).nullable().optional(),
  hours: z.string().max(60).nullable().optional(),
  requirements: z.array(z.string().max(300)).max(30).optional(),
  url: z
    .string()
    .url('Must be a valid URL')
    .nullable()
    .or(z.literal('').transform(() => null)),
  contact: z.string().max(200).nullable().optional(),
  status: CareerStatusSchema.default('saved'),
  deadline_at: z.string().datetime({ offset: true }).nullable().optional(),
  notes: z.string().max(10000).nullable().optional(),
  source_capture_id: z.string().uuid().nullable().optional(),
});

export type OpportunityCreate = z.infer<typeof OpportunityCreateSchema>;

export const OpportunityUpdateSchema = OpportunityCreateSchema.partial().extend({
  id: z.string().uuid(),
});

export const InterviewCreateSchema = z.object({
  opportunity_id: z.string().uuid(),
  scheduled_at: z.string().datetime({ offset: true }),
  round: z.string().max(100).nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
});

export const VolunteeringCreateSchema = z.object({
  organization: z.string().trim().min(1, 'Organization is required').max(200),
  opportunity: z.string().trim().min(1, 'Opportunity is required').max(300),
  role: z.string().max(200).nullable().optional(),
  date: z.string().date().nullable().optional(),
  hours: z.coerce.number().min(0).max(10000).nullable().optional(),
  description: z.string().max(5000).nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
});

export const KarateSessionCreateSchema = z.object({
  date: z.string().date(),
  duration_min: z.coerce.number().int().min(1).max(600),
  focus: z.enum(['kata', 'kumite', 'conditioning', 'technique', 'grading', 'competition']),
  notes: z.string().max(5000).nullable().optional(),
});

export const MealCreateSchema = z.object({
  date: z.string().date(),
  meal_type: z.enum(['breakfast', 'lunch', 'dinner', 'snack']),
  description: z.string().max(500).nullable().optional(),
  home_cooked: z.boolean().default(false),
  skipped: z.boolean().default(false),
});

export const EntertainmentLogCreateSchema = z.object({
  date: z.string().date(),
  category: z.enum(['movie', 'tv', 'anime', 'game', 'music', 'youtube', 'book', 'social']),
  title: z.string().trim().min(1, 'Title is required').max(300),
  duration_min: z.coerce.number().int().min(1).max(24 * 60),
});

export const MemoryCreateSchema = z.object({
  kind: z.enum(['decision', 'lesson', 'preference', 'fact', 'experience']),
  title: z.string().trim().min(1, 'Title is required').max(300),
  body: z.string().trim().min(1).max(20000),
  source_capture_id: z.string().uuid().nullable().optional(),
});

export const NoteCreateSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(300),
  body: z.string().max(50000).default(''),
  area_id: z.string().uuid().nullable().optional(),
  project_id: z.string().uuid().nullable().optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
});
