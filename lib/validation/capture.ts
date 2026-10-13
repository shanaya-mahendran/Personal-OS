import { z } from 'zod';

/** New capture submission: text and/or an uploaded file reference. */
export const CaptureInputSchema = z
  .object({
    raw_text: z.string().trim().max(20000, 'Capture is too long').optional(),
    storage_path: z.string().max(1024).optional(),
    input_type: z.enum(['text', 'image', 'paste', 'voice', 'document']).default('text'),
  })
  .refine((v) => Boolean(v.raw_text?.length || v.storage_path), {
    message: 'Capture something first',
  });

export type CaptureInput = z.infer<typeof CaptureInputSchema>;

/** Creating a capture row server-side. */
export const NewCaptureSchema = z.object({
  raw_text: z.string().trim().min(1).max(20000).optional(),
  storage_path: z.string().max(1024).optional(),
  input_type: z.enum(['text', 'image', 'voice', 'document', 'paste']),
});

/** Confirmation payload returned by the CapturePreview form. */
export const ConfirmCaptureSchema = z.object({
  capture_id: z.string().uuid(),
  entity_type: z.enum(['task', 'event', 'note', 'memory', 'career_opportunity', 'reminder']),
  payload: z.record(z.string(), z.unknown()),
});

export type ConfirmCapture = z.infer<typeof ConfirmCaptureSchema>;
