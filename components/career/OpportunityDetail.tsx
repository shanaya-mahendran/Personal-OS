'use client';

/**
 * Opportunity detail: pipeline status, details, interviews (auto-create a
 * calendar event with conflict detection, spec §12).
 */
import * as React from 'react';
import { useRouter } from 'next/navigation';
import type { CareerOpportunityRow, InterviewRow, CareerApplicationRow } from '@/lib/supabase/types';
import { createInterview, updateOpportunityStatus } from '@/lib/actions/modules';
import { ConflictDialog } from '@/components/calendar/ConflictDialog';
import type { OverlappingEvent } from '@/lib/calendar/conflicts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/field';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatDate, formatTime, DEFAULT_TZ } from '@/lib/utils/dates';

export function OpportunityDetail({
  opportunity,
  interviews,
  applications,
}: {
  opportunity: CareerOpportunityRow;
  interviews: InterviewRow[];
  applications: CareerApplicationRow[];
}) {
  const router = useRouter();
  const [status, setStatus] = React.useState(opportunity.status);
  const [round, setRound] = React.useState('');
  const [scheduledAt, setScheduledAt] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [conflict, setConflict] = React.useState<OverlappingEvent[] | null>(null);

  async function changeStatus(next: string) {
    setStatus(next as CareerOpportunityRow['status']);
    await updateOpportunityStatus(opportunity.id, next as CareerOpportunityRow['status']);
    router.refresh();
  }

  async function scheduleInterview(e: React.FormEvent) {
    e.preventDefault();
    if (!scheduledAt) return;
    setBusy(true);
    setError(null);
    const res = await createInterview({
      opportunity_id: opportunity.id,
      scheduled_at: new Date(scheduledAt).toISOString(),
      round: round || null,
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? 'Could not schedule');
      return;
    }
    if (res.data?.status === 'conflict') {
      setConflict(res.data.overlapping);
      return;
    }
    setRound('');
    setScheduledAt('');
    router.refresh();
  }

  return (
    <div className="mx-auto grid max-w-[560px] gap-4">
      <header>
        <p className="text-[11px] font-medium uppercase tracking-widest text-muted">Opportunity</p>
        <h1 className="mt-1 text-xl font-semibold tracking-tight">
          {opportunity.role} · {opportunity.company}
        </h1>
        <div className="mt-2 flex flex-wrap gap-2">
          <Badge variant="secondary">{opportunity.type ?? 'type unknown'}</Badge>
          <Badge variant="default">{opportunity.work_mode ?? 'mode unknown'}</Badge>
          {opportunity.location ? <Badge variant="default">{opportunity.location}</Badge> : null}
          {opportunity.deadline_at ? (
            <Badge variant="warning">deadline {formatDate(opportunity.deadline_at)}</Badge>
          ) : null}
        </div>
      </header>

      <Field label="Pipeline status" htmlFor="opp-status">
        <Select value={status} onValueChange={(v) => void changeStatus(v)}>
          <SelectTrigger id="opp-status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[
              'saved',
              'applied',
              'screening',
              'interview',
              'technical',
              'offer',
              'accepted',
              'rejected',
              'withdrawn',
            ].map((s) => (
              <SelectItem key={s} value={s}>
                {s[0]!.toUpperCase() + s.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      {opportunity.url ? (
        <a
          href={opportunity.url}
          target="_blank"
          rel="noreferrer noopener"
          className="break-all text-sm text-grove underline-offset-4 hover:underline"
        >
          {opportunity.url}
        </a>
      ) : null}

      {opportunity.requirements && opportunity.requirements.length > 0 ? (
        <section className="rounded-2xl border border-line bg-surface p-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
            Requirements
          </p>
          <ul className="grid gap-1.5 text-sm text-ink">
            {opportunity.requirements.map((r) => (
              <li key={r} className="flex gap-2">
                <span className="text-grove">·</span>
                {r}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {opportunity.notes ? (
        <section className="rounded-2xl border border-line bg-surface p-4">
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">Notes</p>
          <p className="whitespace-pre-wrap text-sm text-ink">{opportunity.notes}</p>
        </section>
      ) : null}

      {applications.length > 0 ? (
        <p className="font-mono text-xs tabular text-muted">
          Applied {formatDate(applications[0]!.applied_at, DEFAULT_TZ)}
        </p>
      ) : null}

      <section className="rounded-2xl border border-line bg-surface p-4">
        <p className="mb-2 text-sm font-semibold">Interviews</p>
        {interviews.length === 0 ? (
          <p className="mb-3 text-sm text-muted">No interviews scheduled.</p>
        ) : (
          <ul className="hairline-divide mb-3">
            {interviews.map((iv) => (
              <li key={iv.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                <span className="text-ink">{iv.round ?? 'Round'}</span>
                <span className="font-mono text-xs tabular text-muted">
                  {formatDate(iv.scheduled_at)} {formatTime(iv.scheduled_at)}
                </span>
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={(e) => void scheduleInterview(e)} className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Round" htmlFor="iv-round">
              <Input id="iv-round" value={round} onChange={(e) => setRound(e.target.value)} placeholder="Technical" />
            </Field>
            <Field label="When" htmlFor="iv-when">
              <Input
                id="iv-when"
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                required
              />
            </Field>
          </div>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <Button type="submit" size="sm" disabled={busy}>
            {busy ? 'Scheduling…' : 'Schedule interview'}
          </Button>
        </form>
      </section>

      <ConflictDialog
        open={conflict !== null}
        overlapping={conflict ?? []}
        onKeepBoth={async () => {
          const id = conflict?.[0]?.id;
          setConflict(null);
          // Keep both: schedule the interview anyway, acknowledging the clash.
          if (!scheduledAt) return;
          setBusy(true);
          await createInterview({
            opportunity_id: opportunity.id,
            scheduled_at: new Date(scheduledAt).toISOString(),
            round: round || null,
            force: true,
          });
          setBusy(false);
          void id;
          setRound('');
          setScheduledAt('');
          router.refresh();
        }}
        onEditTimes={() => setConflict(null)}
        onCancel={() => setConflict(null)}
      />
    </div>
  );
}
