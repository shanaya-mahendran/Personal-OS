'use client';

/**
 * Career Kanban (spec §12): Saved → Applied → Screening → Interview →
 * Technical → Offer → Accepted/Rejected/Withdrawn.
 * Opportunities are also capturable via Universal Capture.
 */
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from '@phosphor-icons/react';
import type { CareerOpportunityRow, AreaRow } from '@/lib/supabase/types';
import { OpportunityCreateSchema } from '@/lib/validation/career';
import { createOpportunity, updateOpportunityStatus } from '@/lib/actions/modules';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field, EmptyState } from '@/components/ui/field';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatDate } from '@/lib/utils/dates';

const COLUMNS = [
  { key: 'saved', label: 'Saved' },
  { key: 'applied', label: 'Applied' },
  { key: 'screening', label: 'Screening' },
  { key: 'interview', label: 'Interview' },
  { key: 'technical', label: 'Technical' },
  { key: 'offer', label: 'Offer' },
  { key: 'accepted', label: 'Accepted' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'withdrawn', label: 'Withdrawn' },
] as const;

export function CareerBoard({
  opportunities,
}: {
  opportunities: CareerOpportunityRow[];
  areas: Pick<AreaRow, 'id' | 'name'>[];
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [company, setCompany] = React.useState('');
  const [role, setRole] = React.useState('');
  const [url, setUrl] = React.useState('');
  const [workMode, setWorkMode] = React.useState('none');
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [dragId, setDragId] = React.useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = OpportunityCreateSchema.safeParse({
      company: company.trim(),
      role: role.trim(),
      url: url.trim() || null,
      work_mode: workMode !== 'none' ? workMode : null,
      status: 'saved',
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Check the form');
      return;
    }
    setBusy(true);
    const res = await createOpportunity(parsed.data);
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? 'Could not save');
      return;
    }
    setOpen(false);
    setCompany('');
    setRole('');
    setUrl('');
    router.refresh();
  }

  const totalOpen = opportunities.filter(
    (o) => o.status !== 'accepted' && o.status !== 'rejected' && o.status !== 'withdrawn',
  ).length;

  return (
    <div className="grid gap-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Career</h1>
          <p className="text-sm text-muted">
            {totalOpen} active · {opportunities.length} total
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus size={15} /> Add
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New opportunity</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => void submit(e)} className="grid gap-3">
              <Field label="Company" htmlFor="c-company" required>
                <Input id="c-company" value={company} onChange={(e) => setCompany(e.target.value)} required />
              </Field>
              <Field label="Role" htmlFor="c-role" required>
                <Input id="c-role" value={role} onChange={(e) => setRole(e.target.value)} required />
              </Field>
              <Field label="Link" htmlFor="c-url">
                <Input id="c-url" type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" />
              </Field>
              <Field label="Work mode" htmlFor="c-mode">
                <Select value={workMode} onValueChange={setWorkMode}>
                  <SelectTrigger id="c-mode">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Unknown</SelectItem>
                    <SelectItem value="remote">Remote</SelectItem>
                    <SelectItem value="hybrid">Hybrid</SelectItem>
                    <SelectItem value="onsite">Onsite</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              {error ? <p className="text-sm text-danger">{error}</p> : null}
              <Button type="submit" disabled={busy}>
                {busy ? 'Saving…' : 'Save opportunity'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </header>

      {opportunities.length === 0 ? (
        <div className="rounded-2xl border border-line bg-surface">
          <EmptyState message="No opportunities yet. Paste a job ad into capture and it lands here." />
        </div>
      ) : (
        <div className="-mx-4 overflow-x-auto px-4 pb-2">
          <div className="flex min-w-max gap-3">
            {COLUMNS.map((col) => {
              const items = opportunities.filter((o) => o.status === col.key);
              return (
                <div
                  key={col.key}
                  className="w-64 shrink-0 rounded-2xl border border-line bg-surface p-3"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={async (e) => {
                    e.preventDefault();
                    const id = dragId ?? e.dataTransfer.getData('text/plain');
                    if (!id) return;
                    setDragId(null);
                    await updateOpportunityStatus(id, col.key);
                    router.refresh();
                  }}
                >
                  <p className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-muted">
                    {col.label}
                    <span className="font-mono tabular">{items.length}</span>
                  </p>
                  <ul className="grid gap-2">
                    {items.length === 0 ? (
                      <li className="py-3 text-center text-[11px] text-muted">Empty</li>
                    ) : (
                      items.map((o) => (
                        <li key={o.id} draggable onDragStart={() => setDragId(o.id)}>
                          <button
                            type="button"
                            onClick={() => router.push(`/career/${o.id}`)}
                            className="w-full rounded-xl border border-line bg-canvas px-3 py-2.5 text-left transition-colors hover:border-grove/40"
                          >
                            <span className="block truncate text-sm font-medium text-ink">
                              {o.role}
                            </span>
                            <span className="block truncate text-xs text-muted">{o.company}</span>
                            <span className="mt-1 flex items-center justify-between font-mono text-[10px] tabular text-muted">
                              <span>{o.work_mode ?? '—'}</span>
                              {o.deadline_at ? <span>{formatDate(o.deadline_at)}</span> : null}
                            </span>
                          </button>
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
