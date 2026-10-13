'use client';

/**
 * ContextBanner: the hero line of the dashboard.
 * Announces the current context honestly — including "I don't have enough
 * context right now" — and never claims a location it can't verify.
 */
import * as React from 'react';
import { useContextEngine } from '@/components/context/ContextProvider';
import { CONTEXT_LABELS } from '@/lib/context/states';
import { Skeleton } from '@/components/ui/skeleton';

export function ContextBanner({ headline }: { headline?: string | null }) {
  const { result, loading } = useContextEngine();

  if (loading) return <Skeleton className="h-16 w-full" />;

  const context = result?.context ?? 'UNKNOWN';
  const label = CONTEXT_LABELS[context];
  const unknown = context === 'UNKNOWN';

  return (
    <section className="rounded-2xl border border-line bg-surface px-4 py-4">
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">
        {unknown ? 'Context unsure' : label}
      </p>
      <p className="mt-1 text-lg font-semibold leading-snug tracking-tight text-ink">
        {unknown
          ? "I don't have enough context right now"
          : headline ?? `${label} is your focus right now`}
      </p>
      {!unknown && result ? (
        <p className="mt-1 font-mono text-[11px] tabular text-muted">
          {result.label}
          {result.time_match ? ' · time matches' : ''}
          {result.location_match ? ' · geofence match' : ''}
          {' · '}
          {Math.round(result.confidence * 100)}% confident
        </p>
      ) : null}
    </section>
  );
}
