import { z } from 'zod';

export const EventStatusSchema = z.enum(['scheduled', 'cancelled', 'completed']);

const EventObjectSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(300),
  description: z.string().max(5000).optional(),
  start_at: z.string().datetime({ offset: true, message: 'Start time is required' }),
  end_at: z.string().datetime({ offset: true, message: 'End time is required' }),
  timezone: z.string().default('Asia/Colombo'),
  location: z.string().max(300).nullable().optional(),
  organizer: z.string().max(300).nullable().optional(),
  status: EventStatusSchema.default('scheduled'),
  source_id: z.string().uuid().nullable().optional(),
});

export const EventCreateSchema = EventObjectSchema.refine(
  (e) => new Date(e.end_at).getTime() > new Date(e.start_at).getTime(),
  {
    message: 'End time must be after start time',
    path: ['end_at'],
  },
);

/** Update variant: partial fields (the action re-checks final start/end). */
export const EventUpdateSchema = EventObjectSchema.partial().extend({
  id: z.string().uuid(),
});

export type EventCreate = z.infer<typeof EventCreateSchema>;
export type EventUpdate = z.infer<typeof EventUpdateSchema>;
