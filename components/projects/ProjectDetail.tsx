'use client';

/**
 * Project detail: edit core fields (goal, next_action nudge, status),
 * plus the project's tasks.
 */
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Plus } from '@phosphor-icons/react';
import type { ProjectRow, TaskRow, AreaRow } from '@/lib/supabase/types';
import { updateProject, createTask, toggleTask } from '@/lib/actions/tasks';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Field } from '@/components/ui/field';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatDate, formatTime } from '@/lib/utils/dates';
import { cn } from '@/lib/utils/cn';

function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ProjectDetail({
  project,
  tasks,
}: {
  project: ProjectRow;
  tasks: TaskRow[];
  areas: Pick<AreaRow, 'id' | 'name'>[];
}) {
  const router = useRouter();
  const [title, setTitle] = React.useState(project.title);
  const [description, setDescription] = React.useState(project.description ?? '');
  const [goal, setGoal] = React.useState(project.goal ?? '');
  const [nextAction, setNextAction] = React.useState(project.next_action ?? '');
  const [status, setStatus] = React.useState(project.status);
  const [deadline, setDeadline] = React.useState(toLocalInput(project.deadline_at));
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);

  const [newTaskTitle, setNewTaskTitle] = React.useState('');
  const [addingTask, setAddingTask] = React.useState(false);

  const openTasks = tasks.filter((t) => t.status !== 'done');
  const needsNextAction = status === 'active' && !nextAction.trim();

  async function save() {
    setBusy(true);
    const res = await updateProject({
      id: project.id,
      title,
      description: description || undefined,
      goal: goal || undefined,
      next_action: nextAction.trim() || null,
      status,
      deadline_at: deadline ? new Date(deadline).toISOString() : null,
    });
    setBusy(false);
    setMessage(res.ok ? 'Saved' : (res.error ?? 'Could not save'));
    if (res.ok) {
      setTimeout(() => setMessage(null), 2000);
      router.refresh();
    }
  }

  async function addTask(e: React.FormEvent) {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    setAddingTask(true);
    await createTask({
      title: newTaskTitle.trim(),
      project_id: project.id,
      area_id: project.area_id,
      priority: 'medium',
    });
    setNewTaskTitle('');
    setAddingTask(false);
    router.refresh();
  }

  return (
    <div className="mx-auto grid max-w-[560px] gap-4">
      <header>
        <p className="text-[11px] font-medium uppercase tracking-widest text-muted">Project</p>
        <h1 className="mt-1 text-xl font-semibold tracking-tight">{project.title}</h1>
        <p className="font-mono text-[11px] tabular text-muted">
          {openTasks.length} open tasks
          {project.deadline_at ? ` · due ${formatDate(project.deadline_at)}` : ''}
        </p>
      </header>

      {needsNextAction ? (
        <div className="flex items-center gap-2 rounded-xl border border-warning/40 bg-warning/[0.07] px-3 py-2.5 text-sm text-warning">
          <ArrowRight size={15} /> This project needs a next action.
        </div>
      ) : null}

      <Field label="Title" htmlFor="p-title" required>
        <Input id="p-title" value={title} onChange={(e) => setTitle(e.target.value)} />
      </Field>
      <Field label="Goal" htmlFor="p-goal" helper="What does done look like?">
        <Textarea id="p-goal" value={goal} onChange={(e) => setGoal(e.target.value)} rows={2} />
      </Field>
      <Field
        label="Next action"
        htmlFor="p-next"
        helper="The very next physical step"
        error={needsNextAction ? 'Required while the project is active' : undefined}
      >
        <Input id="p-next" value={nextAction} onChange={(e) => setNextAction(e.target.value)} />
      </Field>
      <Field label="Description" htmlFor="p-desc">
        <Textarea id="p-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={4} />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Status" htmlFor="p-status">
          <Select value={status} onValueChange={(v) => setStatus(v as ProjectRow['status'])}>
            <SelectTrigger id="p-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="paused">Paused</SelectItem>
              <SelectItem value="done">Done</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Deadline" htmlFor="p-deadline">
          <Input id="p-deadline" type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
        </Field>
      </div>

      <div className="flex items-center gap-2">
        <Button onClick={() => void save()} disabled={busy}>
          {busy ? 'Saving…' : 'Save'}
        </Button>
        {message ? <span className="text-sm text-grove">{message}</span> : null}
      </div>

      <section className="rounded-2xl border border-line bg-surface p-4">
        <h2 className="mb-2 text-sm font-semibold">Tasks</h2>
        <form onSubmit={(e) => void addTask(e)} className="mb-3 flex gap-2">
          <Input
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            placeholder="Add a task to this project"
            aria-label="New task title"
            className="h-9"
          />
          <Button type="submit" size="sm" disabled={addingTask || !newTaskTitle.trim()}>
            <Plus size={15} />
          </Button>
        </form>

        {tasks.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted">No tasks in this project yet.</p>
        ) : (
          <ul className="hairline-divide">
            {tasks.map((t) => {
              const done = t.status === 'done';
              return (
                <li key={t.id} className="flex min-h-[44px] items-center gap-3 py-2">
                  <button
                    type="button"
                    aria-label={done ? `Reopen ${t.title}` : `Complete ${t.title}`}
                    onClick={async () => {
                      await toggleTask(t.id, !done);
                      router.refresh();
                    }}
                    className={cn(
                      'h-5 w-5 shrink-0 rounded-full border transition-colors',
                      done ? 'border-grove bg-grove' : 'border-line bg-surface hover:border-grove',
                    )}
                  />
                  <button
                    type="button"
                    onClick={() => router.push(`/tasks/${t.id}`)}
                    className={cn('min-w-0 flex-1 truncate text-left text-sm', done ? 'text-muted line-through' : 'text-ink')}
                  >
                    {t.title}
                  </button>
                  {t.due_at ? (
                    <span className="font-mono text-[11px] tabular text-muted">
                      {formatDate(t.due_at)} {formatTime(t.due_at)}
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
