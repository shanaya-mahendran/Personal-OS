'use client';

/**
 * ConfidenceBadge + per-field confidence display (spec §5.3).
 * Fields below 0.75 render with the warning treatment and a "Check this"
 * nudge below 0.85 (design §4).
 */
import { Warning } from '@phosphor-icons/react';
import { cn } from '@/lib/utils/cn';
import { LOW_CONFIDENCE, NUDGE_CONFIDENCE, type ConfidenceMap } from '@/lib/gemini/schemas';

export function confidenceFor(conf: ConfidenceMap | null | undefined, field: string): number | undefined {
  if (!conf) return undefined;
  const v = conf[field];
  return typeof v === 'number' ? v : undefined;
}

export function isLowConfidenceField(conf: ConfidenceMap | null | undefined, field: string): boolean {
  const v = confidenceFor(conf, field);
  return typeof v === 'number' && v < LOW_CONFIDENCE;
}

export function ConfidenceBadge({
  value,
  className,
}: {
  value: number | undefined;
  className?: string;
}) {
  if (typeof value !== 'number') return null;
  const pct = Math.round(value * 100);
  const low = value < LOW_CONFIDENCE;
  const medium = !low && value < NUDGE_CONFIDENCE;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-mono text-[10px] tabular',
        low && 'bg-warning/10 text-warning',
        medium && 'bg-black/[0.05] text-muted dark:bg-white/10',
        !low && !medium && 'bg-grove-tint text-grove',
        className,
      )}
      title={`AI confidence ${pct}%`}
    >
      {low ? <Warning size={10} weight="fill" /> : null}
      {pct}%
    </span>
  );
}

/** Amber treatment wrapper for a low-confidence field. */
export function FieldWithConfidence({
  label,
  value,
  conf,
  field,
  children,
}: {
  label: string;
  value?: string | null;
  conf: ConfidenceMap | null | undefined;
  field: string;
  children: React.ReactNode;
}) {
  const confValue = confidenceFor(conf, field);
  const low = typeof confValue === 'number' && confValue < LOW_CONFIDENCE;
  const nudge = typeof confValue === 'number' && confValue < NUDGE_CONFIDENCE;

  return (
    <div className="grid gap-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted">{label}</span>
        <ConfidenceBadge value={confValue} />
      </div>
      <div
        className={cn(
          'rounded-xl border px-3 py-2',
          low ? 'border-warning/40 bg-warning/[0.06]' : 'border-line bg-surface',
        )}
      >
        {children ?? <p className="text-sm text-ink">{value || '—'}</p>}
      </div>
      {low && nudge ? (
        <p className="text-[11px] font-medium text-warning">Check this, the source was ambiguous</p>
      ) : null}
    </div>
  );
}
