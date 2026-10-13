'use client';

/**
 * Projects: finite outcomes with a required next_action (the UI nudges when
 * it is empty, per spec §11).
 */
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Plus, ArrowRight } from '@phosphor-icons/react';
import type { ProjectRow, AreaRow, TaskRow } from '@/lib/supabase/types';
import { ProjectCreateSchema } from '@/lib/validation/task';
import { createProject } from '@/lib/actions/tasks';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field, EmptyState } from '@/components/ui/field';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/utils/dates';
import { cn } from '@/lib/utils/cn';

export function ProjectsView({
  projects,
  areas,
  tasks,
}: {
  projects: ProjectRow[];
  areas: Pick<AreaRow, 'id' | 'name'>[];
  tasks: Pick<TaskRow, 'id' | 'project_id' | 'status' | 'title'>[];
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [title, setTitle] = React.useState('');
  const [goal, setGoal] = React.useState('');
  const [areaId, setAreaId] = React.useState('none');
  const [deadline, setDeadline] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const areaName = new Map(areas.map((a) => [a.id, a.name]));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = ProjectCreateSchema.safeParse({
      title,
      goal: goal || undefined,
      area_id: areaId !== 'none' ? areaId : null,
      deadline_at: deadline ? new Date(deadline).toISOString() : null,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Check the form');
      return;
    }
    setBusy(true);
    const res = await createProject(parsed.data);
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? 'Could not create project');
      return;
    }
    setOpen(false);
    setTitle('');
    setGoal('');
    router.refresh();
  }

  return (
    <div className="grid gap-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Projects</h1>
          <p className="text-sm text-muted">Finite outcomes with a next action</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus size={15} /> New project
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New project</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => void submit(e)} className="grid gap-3">
              <Field label="Title" htmlFor="proj-title" required>
                <Input id="proj-title" value={title} onChange={(e) => setTitle(e.target.value)} required />
              </Field>
              <Field label="Goal" htmlFor="proj-goal" helper="What does done look like?">
                <Input id="proj-goal" value={goal} onChange={(e) => setGoal(e.target.value)} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Area" htmlFor="proj-area">
                  <Select value={areaId} onValueChange={setAreaId}>
                    <SelectTrigger id="proj-area">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {areas.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Deadline" htmlFor="proj-deadline">
                  <Input
                    id="proj-deadline"
                    type="date"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                  />
                </Field>
              </div>
              {error ? <p className="text-sm text-danger">{error}</p> : null}
              <Button type="submit" disabled={busy}>
                {busy ? 'Creating…' : 'Create project'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </header>

      {projects.length === 0 ? (
        <div className="rounded-2xl border border-line bg-surface">
          <EmptyState message="No projects yet. Projects are finite outcomes, not areas of life." />
        </div>
      ) : (
        <ul className="hairline-divide rounded-2xl border border-line bg-surface">
          {projects.map((p) => {
            const projectTasks = tasks.filter((t) => t.project_id === p.id);
            const openCount = projectTasks.filter((t) => t.status !== 'done').length;
            const needsNextAction = p.status === 'active' && !p.next_action;
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => router.push(`/projects/${p.id}`)}
                  className="w-full px-4 py-3.5 text-left"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="truncate text-sm font-medium text-ink">{p.title}</span>
                    <span className="shrink-0 font-mono text-xs tabular text-muted">
                      {openCount} open
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted">
                    {p.area_id ? <span>{areaName.get(p.area_id)}</span> : null}
                    {p.deadline_at ? <span className="font-mono tabular">due {formatDate(p.deadline_at)}</span> : null}
                    <Badge variant={p.status === 'active' ? 'default' : 'secondary'}>{p.status}</Badge>
                  </div>
                  {needsNextAction ? (
                    <p className="mt-1.5 flex items-center gap-1 text-[11px] font-medium text-warning">
                      <ArrowRight size={11} /> Add a next action to keep this moving
                    </p>
                  ) : p.next_action ? (
                    <p className={cn('mt-1.5 truncate text-[11px] text-grove')}>Next: {p.next_action}</p>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
