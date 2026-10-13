'use client';

/**
 * Volunteering: list + domain-specific create form + aggregated hours
 * (spec §13). Numbers are only shown when actually computed from rows.
 */
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from '@phosphor-icons/react';
import type { VolunteeringRow } from '@/lib/supabase/types';
import { VolunteeringCreateSchema } from '@/lib/validation/career';
import { createVolunteering } from '@/lib/actions/modules';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Field, EmptyState } from '@/components/ui/field';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { formatDate } from '@/lib/utils/dates';
import { formatHours } from '@/lib/utils/format';

export function VolunteeringView({ records }: { records: VolunteeringRow[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState({
    organization: '',
    opportunity: '',
    role: '',
    date: '',
    hours: '',
    description: '',
  });
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const totalHours = records.reduce((sum, r) => sum + Number(r.hours ?? 0), 0);
  const thisYear = new Date().getFullYear();
  const yearHours = records
    .filter((r) => r.date?.startsWith(String(thisYear)))
    .reduce((sum, r) => sum + Number(r.hours ?? 0), 0);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = VolunteeringCreateSchema.safeParse({
      organization: form.organization.trim(),
      opportunity: form.opportunity.trim(),
      role: form.role.trim() || null,
      date: form.date || null,
      hours: form.hours ? Number(form.hours) : null,
      description: form.description.trim() || null,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Check the form');
      return;
    }
    setBusy(true);
    const res = await createVolunteering(parsed.data);
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? 'Could not save');
      return;
    }
    setOpen(false);
    setForm({ organization: '', opportunity: '', role: '', date: '', hours: '', description: '' });
    router.refresh();
  }

  return (
    <div className="grid gap-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Volunteering</h1>
          <p className="font-mono text-sm tabular text-muted">
            {records.length} records · {formatHours(totalHours)} total
            {yearHours > 0 ? ` · ${formatHours(yearHours)} in ${thisYear}` : ''}
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus size={15} /> Add
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[85dvh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>New volunteering record</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => void submit(e)} className="grid gap-3">
              <Field label="Organization" htmlFor="v-org" required>
                <Input
                  id="v-org"
                  value={form.organization}
                  onChange={(e) => setForm({ ...form, organization: e.target.value })}
                  required
                />
              </Field>
              <Field label="Opportunity" htmlFor="v-opp" required>
                <Input
                  id="v-opp"
                  value={form.opportunity}
                  onChange={(e) => setForm({ ...form, opportunity: e.target.value })}
                  required
                />
              </Field>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Role" htmlFor="v-role">
                  <Input
                    id="v-role"
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value })}
                  />
                </Field>
                <Field label="Date" htmlFor="v-date">
                  <Input
                    id="v-date"
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                  />
                </Field>
                <Field label="Hours" htmlFor="v-hours">
                  <Input
                    id="v-hours"
                    type="number"
                    min={0}
                    step={0.5}
                    value={form.hours}
                    onChange={(e) => setForm({ ...form, hours: e.target.value })}
                  />
                </Field>
              </div>
              <Field label="Description" htmlFor="v-desc">
                <Textarea
                  id="v-desc"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3}
                />
              </Field>
              {error ? <p className="text-sm text-danger">{error}</p> : null}
              <Button type="submit" disabled={busy}>
                {busy ? 'Saving…' : 'Save record'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </header>

      {records.length === 0 ? (
        <div className="rounded-2xl border border-line bg-surface">
          <EmptyState message="No volunteering records yet. Add one after your next session." />
        </div>
      ) : (
        <ul className="hairline-divide rounded-2xl border border-line bg-surface">
          {records.map((r) => (
            <li key={r.id} className="flex items-start justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink">{r.opportunity}</p>
                <p className="truncate text-xs text-muted">
                  {r.organization}
                  {r.role ? ` · ${r.role}` : ''}
                  {r.date ? ` · ${formatDate(r.date)}` : ''}
                </p>
              </div>
              <span className="shrink-0 font-mono text-xs tabular text-ink">
                {r.hours != null ? formatHours(Number(r.hours)) : '—'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
