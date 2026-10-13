'use client';

/**
 * Inbox list: pending captures show optimistic processing skeletons;
 * awaiting_confirmation captures open the proposal preview inline.
 */
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowsClockwise } from '@phosphor-icons/react';
import type { CaptureRow } from '@/lib/supabase/types';
import { reprocessCapture } from '@/lib/actions/capture';
import { CapturePreview } from '@/components/capture/CapturePreview';
import { EmptyState } from '@/components/ui/field';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatTime, formatDate } from '@/lib/utils/dates';
import { cn } from '@/lib/utils/cn';

const STATUS_LABELS: Record<string, string> = {
  pending: 'Queued',
  processing: 'Processing',
  awaiting_confirmation: 'Needs confirmation',
  confirmed: 'Confirmed',
  rejected: 'Rejected',
  failed: 'Failed',
};

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'warning' | 'danger' | 'info'> = {
  pending: 'secondary',
  processing: 'info',
  awaiting_confirmation: 'warning',
  confirmed: 'default',
  rejected: 'secondary',
  failed: 'danger',
};

export function InboxView({ captures }: { captures: CaptureRow[] }) {
  const router = useRouter();
  const [expanded, setExpanded] = React.useState<string | null>(null);

  const awaiting = captures.filter((c) => c.processing_status === 'awaiting_confirmation');

  // Auto-open the newest proposal that needs a decision.
  React.useEffect(() => {
    if (expanded === null && awaiting.length > 0) {
      setExpanded(awaiting[0]!.id);
    }
  }, [awaiting, expanded]);

  if (captures.length === 0) {
    return (
      <div className="rounded-2xl border border-line bg-surface">
        <EmptyState
          message="Nothing captured yet. Use the button below or paste anything into the capture bar."
        />
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Inbox</h1>
        <p className="text-sm text-muted">
          {awaiting.length > 0
            ? `${awaiting.length} waiting for your confirmation`
            : 'Everything captured, nothing pending'}
        </p>
      </header>

      <ul className="grid gap-3">
        {captures.map((capture) => {
          const isOpen = expanded === capture.id;
          const needsInput =
            capture.processing_status === 'awaiting_confirmation' ||
            capture.processing_status === 'failed';
          return (
            <li
              key={capture.id}
              className={cn(
                'rounded-2xl border bg-surface p-4 transition-colors',
                needsInput ? 'border-warning/40' : 'border-line',
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm text-ink">
                    {capture.raw_text ??
                      (capture.storage_path
                        ? `Attachment: ${capture.storage_path.split('/').pop()}`
                        : '(empty capture)')}
                  </p>
                  <p className="mt-1 font-mono text-[11px] tabular text-muted">
                    {formatDate(capture.created_at)} {formatTime(capture.created_at)}
                    {capture.created_entity_type ? ` → ${capture.created_entity_type}` : ''}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <Badge variant={STATUS_VARIANT[capture.processing_status] ?? 'secondary'}>
                    {STATUS_LABELS[capture.processing_status] ?? capture.processing_status}
                  </Badge>
                  {capture.processing_status === 'pending' ||
                  capture.processing_status === 'processing' ? (
                    <span className="flex items-center gap-1 text-[11px] text-muted">
                      <ArrowsClockwise size={11} className="animate-spin" /> working
                    </span>
                  ) : null}
                </div>
              </div>

              {capture.processing_status === 'failed' ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={async () => {
                    await reprocessCapture(capture.id);
                    router.refresh();
                  }}
                >
                  Retry processing
                </Button>
              ) : null}

              {isOpen && capture.processing_status === 'awaiting_confirmation' ? (
                <div className="mt-4 border-t border-line pt-4">
                  <CapturePreview
                    captureId={capture.id}
                    onDone={() => {
                      setExpanded(null);
                      router.refresh();
                    }}
                  />
                </div>
              ) : null}

              {!isOpen && capture.processing_status === 'awaiting_confirmation' ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => setExpanded(capture.id)}
                >
                  Review proposal
                </Button>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
