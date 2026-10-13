'use client';

/**
 * CapturePreview: renders the AI extraction as an editable proposal card
 * (spec §6.5).
 *
 * - per-field confidence badges; fields < 0.75 get the amber treatment
 * - Confirm runs server-side validation + conflict detection
 * - Reject never deletes raw_text/storage_path (provenance)
 */
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Check, Pencil, X, Plus } from '@phosphor-icons/react';
import type { CaptureRow, Json } from '@/lib/supabase/types';
import { confirmCapture, getCapture, rejectCapture, reprocessCapture } from '@/lib/actions/capture';
import type { OverlappingEvent } from '@/lib/calendar/conflicts';
import { ConfidenceBadge, isLowConfidenceField } from '@/components/capture/ConfidenceBadge';
import { ConflictDialog } from '@/components/calendar/ConflictDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils/cn';

type AiResult = { type: string } & Record<string, Json>;

interface FieldSpec {
  key: string;
  label: string;
  kind: 'text' | 'textarea' | 'datetime' | 'readonly';
  confidenceKey?: string;
}

const FIELD_SPECS: Record<string, FieldSpec[]> = {
  task: [
    { key: 'title', label: 'Title', kind: 'text', confidenceKey: 'title' },
    { key: 'description', label: 'Description', kind: 'textarea', confidenceKey: 'description' },
    { key: 'due_at', label: 'Due', kind: 'datetime', confidenceKey: 'date' },
    { key: 'priority', label: 'Priority', kind: 'text', confidenceKey: 'priority' },
    { key: 'area_hint', label: 'Area', kind: 'text', confidenceKey: 'area' },
  ],
  event: [
    { key: 'title', label: 'Title', kind: 'text', confidenceKey: 'title' },
    { key: 'start_at', label: 'Starts', kind: 'datetime', confidenceKey: 'date' },
    { key: 'end_at', label: 'Ends', kind: 'datetime', confidenceKey: 'date' },
    { key: 'location', label: 'Location', kind: 'text', confidenceKey: 'location' },
    { key: 'organizer', label: 'Organizer', kind: 'text', confidenceKey: 'organizer' },
    { key: 'description', label: 'Description', kind: 'textarea', confidenceKey: 'description' },
  ],
  career_opportunity: [
    { key: 'company', label: 'Company', kind: 'text', confidenceKey: 'company' },
    { key: 'role', label: 'Role', kind: 'text', confidenceKey: 'role' },
    { key: 'opportunity_type', label: 'Type', kind: 'text', confidenceKey: 'type' },
    { key: 'work_mode', label: 'Work mode', kind: 'text', confidenceKey: 'work_mode' },
    { key: 'location', label: 'Location', kind: 'text', confidenceKey: 'location' },
    { key: 'deadline_at', label: 'Deadline', kind: 'datetime', confidenceKey: 'deadline' },
    { key: 'url', label: 'Link', kind: 'text', confidenceKey: 'url' },
  ],
  note: [
    { key: 'title', label: 'Title', kind: 'text', confidenceKey: 'title' },
    { key: 'body', label: 'Body', kind: 'textarea', confidenceKey: 'body' },
  ],
  memory: [
    { key: 'kind', label: 'Kind', kind: 'text', confidenceKey: 'kind' },
    { key: 'title', label: 'Title', kind: 'text', confidenceKey: 'title' },
    { key: 'body', label: 'Body', kind: 'textarea', confidenceKey: 'body' },
  ],
  reminder: [
    { key: 'title', label: 'Reminder', kind: 'text', confidenceKey: 'title' },
    { key: 'remind_at', label: 'When', kind: 'datetime', confidenceKey: 'date' },
  ],
  unknown: [{ key: 'reason', label: 'Why', kind: 'readonly', confidenceKey: 'reason' }],
};

const TYPE_LABELS: Record<string, string> = {
  task: 'Task',
  event: 'Event',
  career_opportunity: 'Career opportunity',
  note: 'Note',
  memory: 'Memory',
  reminder: 'Reminder',
  unknown: 'Unclear',
};

/** ISO string → value acceptable by <input type="datetime-local"> */
function toLocalInput(iso: unknown): string {
  if (typeof iso !== 'string' || !iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInput(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function CapturePreview({
  captureId,
  onDone,
}: {
  captureId: string;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [capture, setCapture] = React.useState<CaptureRow | null>(null);
  const [draft, setDraft] = React.useState<Record<string, unknown> | null>(null);
  const [editing, setEditing] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [conflict, setConflict] = React.useState<OverlappingEvent[] | null>(null);

  const load = React.useCallback(async () => {
    const res = await getCapture(captureId);
    if (res.ok && res.data) setCapture(res.data);
  }, [captureId]);

  const markConfirmed = React.useCallback(() => {
    setCapture((c) => (c ? { ...c, processing_status: 'confirmed' } : c));
  }, []);

  // Poll while processing (optimistic UI).
  React.useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    async function tick() {
      if (cancelled) return;
      await load();
      timer = setTimeout(() => void tick(), 1500);
    }
    void tick();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [load]);

  // Sync draft when a fresh extraction arrives.
  React.useEffect(() => {
    if (!capture || draft) return;
    if (capture.ai_result && typeof capture.ai_result === 'object') {
      setDraft({ ...(capture.ai_result as unknown as Record<string, unknown>) });
    }
  }, [capture, draft]);

  if (!capture) {
    return (
      <div className="grid gap-2" aria-busy="true">
        <Skeleton className="h-5 w-1/3" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-2/3" />
      </div>
    );
  }

  const status = capture.processing_status;

  if (status === 'pending' || status === 'processing') {
    return (
      <div className="grid gap-2" aria-busy="true" aria-live="polite">
        <p className="text-sm text-muted">Processing, this takes a moment…</p>
        <Skeleton className="h-5 w-1/3" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-2/3" />
      </div>
    );
  }

  if (status === 'failed') {
    return (
      <div className="grid gap-3">
        <p className="text-sm text-danger">
          Processing failed. Your capture is saved and untouched.
        </p>
        <Button variant="outline" size="sm" onClick={() => void reprocessCapture(captureId)}>
          Try again
        </Button>
      </div>
    );
  }

  if (status === 'confirmed') {
    return (
      <div className="grid gap-3">
        <p className="text-sm text-ink">
          Confirmed
          {capture.created_entity_type ? ` and added to ${TYPE_LABELS[capture.created_entity_type] ?? capture.created_entity_type}.` : '.'}
        </p>
        <Button variant="outline" size="sm" onClick={onDone}>
          <Plus size={15} /> Capture another
        </Button>
      </div>
    );
  }

  if (status === 'rejected') {
    return (
      <div className="grid gap-3">
        <p className="text-sm text-muted">Discarded. The original capture stays in your inbox.</p>
        <Button variant="outline" size="sm" onClick={onDone}>
          Done
        </Button>
      </div>
    );
  }

  // awaiting_confirmation
  const result = (capture.ai_result ?? {}) as AiResult;
  const conf = (capture.confidence ?? {}) as Record<string, number>;
  const type = typeof result.type === 'string' ? result.type : 'unknown';
  const specs = FIELD_SPECS[type] ?? FIELD_SPECS.unknown!;
  const draftValues = draft ?? {};

  async function handleConfirm(createAnother: boolean) {
    if (!draft) return;
    setBusy(true);
    setError(null);
    try {
      const payload = { ...draft };
      // Normalize datetime-local values back to ISO instants.
      if (type === 'event') {
        payload.start_at = fromLocalInput(String(payload.start_at ?? ''));
        payload.end_at = fromLocalInput(String(payload.end_at ?? ''));
        if (!payload.start_at || !payload.end_at) throw new Error('Start and end are required');
      } else if (type === 'task') {
        payload.due_at = fromLocalInput(String(payload.due_at ?? ''));
      } else if (type === 'reminder') {
        payload.remind_at = fromLocalInput(String(payload.remind_at ?? ''));
        if (!payload.remind_at) throw new Error('Reminder time is required');
      } else if (type === 'career_opportunity') {
        payload.deadline_at = fromLocalInput(String(payload.deadline_at ?? ''));
      }

      const res = await confirmCapture({
        capture_id: captureId,
        entity_type: type as 'task' | 'event' | 'note' | 'memory' | 'career_opportunity' | 'reminder',
        payload,
      });
      if (!res.ok) throw new Error(res.error ?? 'Could not confirm');

      const outcome = res.data;
      if (outcome?.status === 'conflict') {
        setConflict(outcome.overlapping);
        return;
      }

      router.refresh();
      if (createAnother) {
        onDone?.();
      } else {
        markConfirmed();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not confirm');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between gap-2">
        <span className="rounded-full bg-grove-tint px-2.5 py-1 text-xs font-medium text-grove">
          Suggested {TYPE_LABELS[type] ?? type}
        </span>
        <ConfidenceBadge
          value={
            Object.values(conf).length > 0
              ? Object.values(conf).reduce((a, b) => a + b, 0) / Object.values(conf).length
              : undefined
          }
        />
      </div>

      {capture.raw_text ? (
        <details className="rounded-xl border border-line bg-black/[0.02] px-3 py-2 text-xs text-muted dark:bg-white/[0.03]">
          <summary className="cursor-pointer font-medium">Original capture</summary>
          <p className="mt-2 whitespace-pre-wrap">{capture.raw_text}</p>
        </details>
      ) : null}
      {capture.storage_path ? (
        <p className="font-mono text-[11px] text-muted">Attachment: {capture.storage_path.split('/').pop()}</p>
      ) : null}

      <div className="grid gap-3">
        {specs.map((spec) => {
          const value = draftValues[spec.key];
          const low = isLowConfidenceField(conf, spec.confidenceKey ?? spec.key);
          const label = (
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-muted">{spec.label}</span>
              <ConfidenceBadge value={conf[spec.confidenceKey ?? spec.key]} />
            </div>
          );
          const base = cn(
            'text-sm',
            low && 'border-warning/50 bg-warning/[0.06] focus-visible:ring-warning',
          );

          if (spec.kind === 'readonly') {
            return (
              <div key={spec.key} className="grid gap-1">
                {label}
                <p className="rounded-xl border border-line bg-surface px-3 py-2 text-sm text-muted">
                  {String(value ?? '—')}
                </p>
              </div>
            );
          }

          if (spec.kind === 'textarea') {
            return (
              <div key={spec.key} className="grid gap-1">
                {label}
                <Textarea
                  className={cn(base, !editing && 'pointer-events-none opacity-70')}
                  readOnly={!editing}
                  value={String(value ?? '')}
                  onChange={(e) => setDraft({ ...draftValues, [spec.key]: e.target.value })}
                />
              </div>
            );
          }

          if (spec.kind === 'datetime') {
            return (
              <div key={spec.key} className="grid gap-1">
                {label}
                <Input
                  type="datetime-local"
                  className={cn(base, !editing && 'pointer-events-none opacity-70')}
                  readOnly={!editing}
                  value={toLocalInput(value)}
                  onChange={(e) => setDraft({ ...draftValues, [spec.key]: e.target.value })}
                />
              </div>
            );
          }

          return (
            <div key={spec.key} className="grid gap-1">
              {label}
              <Input
                className={cn(base, !editing && 'pointer-events-none opacity-70')}
                readOnly={!editing}
                value={String(value ?? '')}
                onChange={(e) => setDraft({ ...draftValues, [spec.key]: e.target.value })}
              />
            </div>
          );
        })}
      </div>

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={() => void handleConfirm(false)} disabled={busy || type === 'unknown'}>
          <Check size={15} /> {busy ? 'Adding…' : 'Confirm'}
        </Button>
        <Button size="sm" variant="outline" onClick={() => void handleConfirm(true)} disabled={busy || type === 'unknown'}>
          <Plus size={15} /> Confirm &amp; create another
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setEditing((v) => !v)}>
          <Pencil size={15} /> {editing ? 'Done editing' : 'Edit'}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={busy}
          onClick={async () => {
            await rejectCapture(captureId);
            onDone?.();
            router.refresh();
          }}
        >
          <X size={15} /> Reject
        </Button>
      </div>

      <ConflictDialog
        open={conflict !== null}
        overlapping={conflict ?? []}
        onKeepBoth={async () => {
          // "Keep both": insert anyway with the conflict acknowledged.
          setConflict(null);
          setBusy(true);
          const payload = { ...(draft ?? {}) };
          if (type === 'event') {
            payload.start_at = fromLocalInput(String(payload.start_at ?? ''));
            payload.end_at = fromLocalInput(String(payload.end_at ?? ''));
          }
          const res = await confirmCapture({
            capture_id: captureId,
            entity_type: 'event',
            payload: { ...payload, force: true },
          });
          setBusy(false);
          if (res.ok && res.data?.status === 'created') {
            markConfirmed();
            router.refresh();
          }
        }}
        onEditTimes={() => setConflict(null)}
        onCancel={() => setConflict(null)}
      />
    </div>
  );
}
