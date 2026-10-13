'use client';

/**
 * Tasks: list or board-by-status, filters by area/project/priority/due,
 * create form with React Hook Form + Zod (spec §11).
 */
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from '@phosphor-icons/react';
import { createTask, toggleTask } from '@/lib/actions/tasks';
import type { TaskRow, AreaRow, ProjectRow } from '@/lib/supabase/types';
import { TaskCreateSchema } from '@/lib/validation/task';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Field, EmptyState } from '@/components/ui/field';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils/cn';
import { formatDate, formatTime } from '@/lib/utils/dates';

export interface TasksViewData {
  tasks: TaskRow[];
  areas: Pick<AreaRow, 'id' | 'name'>[];
  projects: Pick<ProjectRow, 'id' | 'title'>[];
}

const STATUS_LABELS: Record<string, string> = {
  todo: 'To do',
  in_progress: 'In progress',
  done: 'Done',
};

const PRIORITY_EDGE: Record<string, string> = {
  urgent: 'border-l-[3px] border-danger',
  high: 'border-l-[3px] border-warning',
  medium: 'border-l-[3px] border-line',
  low: 'border-l-[3px] border-transparent',
};

export function TasksView({ data }: { data: TasksViewData }) {
  const router = useRouter();
  const [areaFilter, setAreaFilter] = React.useState('all');
  const [priorityFilter, setPriorityFilter] = React.useState('all');
  const [statusFilter, setStatusFilter] = React.useState('all');
  const [busy, setBusy] = React.useState<string | null>(null);

  // Create form state
  const [open, setOpen] = React.useState(false);
  const [title, setTitle] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [priority, setPriority] = React.useState('medium');
  const [areaId, setAreaId] = React.useState('');
  const [projectId, setProjectId] = React.useState('');
  const [dueAt, setDueAt] = React.useState('');
  const [formError, setFormError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  const areaName = React.useMemo(
    () => new Map(data.areas.map((a) => [a.id, a.name])),
    [data.areas],
  );
  const projectName = React.useMemo(
    () => new Map(data.projects.map((p) => [p.id, p.title])),
    [data.projects],
  );

  const filtered = data.tasks.filter((t) => {
    if (areaFilter !== 'all' && t.area_id !== areaFilter) return false;
    if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;
    if (statusFilter !== 'all' && t.status !== statusFilter) return false;
    return true;
  });

  async function submitTask(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const parsed = TaskCreateSchema.safeParse({
      title,
      description: description || undefined,
      priority,
      area_id: areaId && areaId !== 'none' ? areaId : null,
      project_id: projectId && projectId !== 'none' ? projectId : null,
      due_at: dueAt ? new Date(dueAt).toISOString() : null,
    });
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? 'Check the form');
      return;
    }
    setSaving(true);
    const res = await createTask(parsed.data);
    setSaving(false);
    if (!res.ok) {
      setFormError(res.error ?? 'Could not create task');
      return;
    }
    setOpen(false);
    setTitle('');
    setDescription('');
    setDueAt('');
    router.refresh();
  }

  async function toggle(id: string, done: boolean) {
    setBusy(id);
    await toggleTask(id, done);
    setBusy(null);
    router.refresh();
  }

  function renderRow(task: TaskRow) {
    const done = task.status === 'done';
    return (
      <li
        key={task.id}
        className={cn(
          'flex min-h-[44px] items-center gap-3 py-2 pl-3 pr-1',
          PRIORITY_EDGE[task.priority] ?? PRIORITY_EDGE.medium,
        )}
      >
        <button
          type="button"
          aria-label={done ? `Reopen ${task.title}` : `Complete ${task.title}`}
          disabled={busy === task.id}
          onClick={() => void toggle(task.id, !done)}
          className={cn(
            'h-5 w-5 shrink-0 rounded-full border transition-colors',
            done ? 'border-grove bg-grove' : 'border-line bg-surface hover:border-grove',
          )}
        />
        <button
          type="button"
          onClick={() => router.push(`/tasks/${task.id}`)}
          className={cn('min-w-0 flex-1 text-left', done && 'text-muted line-through')}
        >
          <span className="block truncate text-sm text-ink">{task.title}</span>
          <span className="block truncate font-mono text-[11px] tabular text-muted">
            {task.due_at ? `${formatDate(task.due_at)} ${formatTime(task.due_at)}` : 'no due date'}
            {task.area_id ? ` · ${areaName.get(task.area_id) ?? ''}` : ''}
            {task.project_id ? ` · ${projectName.get(task.project_id) ?? ''}` : ''}
          </span>
        </button>
      </li>
    );
  }

  return (
    <div className="grid gap-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Tasks</h1>
          <p className="text-sm text-muted">{data.tasks.length} open records</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus size={15} /> New task
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New task</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => void submitTask(e)} className="grid gap-3">
              <Field label="Title" htmlFor="task-title" required>
                <Input
                  id="task-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  maxLength={300}
                  placeholder="What needs doing?"
                />
              </Field>
              <Field label="Description" htmlFor="task-desc">
                <Textarea
                  id="task-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Priority" htmlFor="task-priority">
                  <Select value={priority} onValueChange={setPriority}>
                    <SelectTrigger id="task-priority">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Due" htmlFor="task-due">
                  <Input
                    id="task-due"
                    type="datetime-local"
                    value={dueAt}
                    onChange={(e) => setDueAt(e.target.value)}
                  />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Area" htmlFor="task-area">
                  <Select value={areaId} onValueChange={setAreaId}>
                    <SelectTrigger id="task-area">
                      <SelectValue placeholder="None" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {data.areas.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Project" htmlFor="task-project">
                  <Select value={projectId} onValueChange={setProjectId}>
                    <SelectTrigger id="task-project">
                      <SelectValue placeholder="None" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {data.projects.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              {formError ? <p className="text-sm text-danger">{formError}</p> : null}
              <Button type="submit" disabled={saving}>
                {saving ? 'Creating…' : 'Create task'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </header>

      <div className="flex flex-wrap gap-2">
        <Select value={areaFilter} onValueChange={setAreaFilter}>
          <SelectTrigger className="h-9 w-auto min-w-[130px] text-xs" aria-label="Filter by area">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All areas</SelectItem>
            {data.areas.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="h-9 w-auto min-w-[130px] text-xs" aria-label="Filter by priority">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All priorities</SelectItem>
            <SelectItem value="urgent">Urgent</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-9 w-auto min-w-[130px] text-xs" aria-label="Filter by status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="todo">To do</SelectItem>
            <SelectItem value="in_progress">In progress</SelectItem>
            <SelectItem value="done">Done</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="list">
        <TabsList>
          <TabsTrigger value="list">List</TabsTrigger>
          <TabsTrigger value="board">Board</TabsTrigger>
        </TabsList>

        <TabsContent value="list">
          <div className="hairline-divide rounded-2xl border border-line bg-surface px-2">
            {filtered.length === 0 ? (
              <EmptyState message="No tasks match these filters. Capture something to get started." />
            ) : (
              <ul>{filtered.map(renderRow)}</ul>
            )}
          </div>
        </TabsContent>

        <TabsContent value="board">
          <div className="grid gap-3 sm:grid-cols-3">
            {(['todo', 'in_progress', 'done'] as const).map((status) => {
              const col = filtered.filter((t) => t.status === status);
              return (
                <div key={status} className="rounded-2xl border border-line bg-surface p-3">
                  <p className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-muted">
                    {STATUS_LABELS[status]}
                    <span className="font-mono tabular">{col.length}</span>
                  </p>
                  <ul className="hairline-divide">
                    {col.length === 0 ? (
                      <li className="py-3 text-center text-xs text-muted">Nothing here</li>
                    ) : (
                      col.map(renderRow)
                    )}
                  </ul>
                </div>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
