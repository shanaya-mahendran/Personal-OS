/**
 * Confidence helpers for AI-extracted fields.
 *
 * Gemini returns a flat `confidence: { field: 0..1 }` map alongside the
 * extraction. We normalize, fill gaps, and expose a single predicate the UI
 * uses to highlight uncertain fields.
 */
import { LOW_CONFIDENCE, type ConfidenceMap } from '@/lib/gemini/schemas';

export { LOW_CONFIDENCE };

/** Clamp + fill missing fields with a conservative default. */
export function normalizeConfidence(
  raw: Record<string, number> | null | undefined,
  fields: string[],
  fallback = 0.5,
): ConfidenceMap {
  const out: ConfidenceMap = {};
  for (const field of fields) {
    const v = raw?.[field];
    out[field] =
      typeof v === 'number' && Number.isFinite(v)
        ? Math.min(1, Math.max(0, v))
        : fallback;
  }
  return out;
}

/** Overall confidence = mean of per-field confidences (0 if empty). */
export function overallConfidence(conf: ConfidenceMap): number {
  const values = Object.values(conf);
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** Field names below the low-confidence threshold, in declaration order. */
export function lowConfidenceFields(conf: ConfidenceMap): string[] {
  return Object.entries(conf)
    .filter(([, v]) => v < LOW_CONFIDENCE)
    .map(([k]) => k);
}

export function isLow(field: string, conf: ConfidenceMap): boolean {
  const v = conf[field];
  return typeof v === 'number' && v < LOW_CONFIDENCE;
}
