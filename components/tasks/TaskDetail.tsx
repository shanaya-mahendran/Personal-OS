'use client';

/**
 * Task detail: inline editing, completion, recurrence preview (client-side
 * RRULE expansion), and user-initiated delete.
 */
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Trash, Check } from '@phosphor-icons/react';
import type { TaskRow, AreaRow, ProjectRow } from '@/lib/supabase/types';
import { TaskUpdateSchema } from '@/lib/validation/task';
import { deleteTask, toggleTask, updateTask } from '@/lib/actions/tasks';
import { expandRRule, parseRRule } from '@/lib/calendar/recurrence';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Field } from '@/components/ui/field';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatDate } from '@/lib/utils/dates';

function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function TaskDetail({
  task,
  areas,
  projects,
}: {
  task: TaskRow;
  areas: Pick<AreaRow, 'id' | 'name'>[];
  projects: Pick<ProjectRow, 'id' | 'title'>[];
}) {
  const router = useRouter();
  const [title, setTitle] = React.useState(task.title);
  const [description, setDescription] = React.useState(task.description ?? '');
  const [status, setStatus] = React.useState(task.status);
  const [priority, setPriority] = React.useState(task.priority);
  const [areaId, setAreaId] = React.useState(task.area_id ?? 'none');
  const [projectId, setProjectId] = React.useState(task.project_id ?? 'none');
  const [dueAt, setDueAt] = React.useState(toLocalInput(task.due_at));
  const [rrule, setRRule] = React.useState(task.recurrence_rule ?? '');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);

  const occurrences = React.useMemo(() => {
    if (!rrule || !parseRRule(rrule)) return [];
    const base = task.due_at ? new Date(task.due_at) : new Date();
    return expandRRule(rrule, base, 10).slice(0, 10);
  }, [rrule, task.due_at]);

  async function save() {
    setBusy(true);
    setError(null);
    const parsed = TaskUpdateSchema.safeParse({
      id: task.id,
      title,
      description: description || undefined,
      priority,
      status,
      area_id: areaId !== 'none' ? areaId : null,
      project_id: projectId !== 'none' ? projectId : null,
      due_at: dueAt ? new Date(dueAt).toISOString() : null,
      recurrence_rule: rrule || null,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Check the form');
      setBusy(false);
      return;
    }
    const res = await updateTask(parsed.data);
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? 'Could not save');
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    router.refresh();
  }

  async function remove() {
    if (!window.confirm('Delete this task? The original capture (if any) stays in your inbox.')) {
      return;
    }
    setBusy(true);
    await deleteTask(task.id);
    router.push('/tasks');
    router.refresh();
  }

  return (
    <div className="mx-auto grid max-w-[560px] gap-4">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-widest text-muted">Task</p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight">{task.title}</h1>
          <p className="font-mono text-[11px] tabular text-muted">
            created {formatDate(task.created_at)}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void remove()}
          aria-label="Delete task"
          className="rounded-full p-2 text-muted hover:bg-danger/10 hover:text-danger"
        >
          <Trash size={17} />
        </button>
      </header>

      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant={status === 'done' ? 'default' : 'outline'}
          onClick={async () => {
            await toggleTask(task.id, status !== 'done');
            setStatus(status === 'done' ? 'todo' : 'done');
            router.refresh();
          }}
        >
          <Check size={15} /> {status === 'done' ? 'Completed' : 'Mark done'}
        </Button>
        {task.source_capture_id ? <Badge variant="secondary">From capture</Badge> : null}
      </div>

      <Field label="Title" htmlFor="edit-title" required>
        <Input id="edit-title" value={title} onChange={(e) => setTitle(e.target.value)} />
      </Field>

      <Field label="Description" htmlFor="edit-desc">
        <Textarea id="edit-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={5} />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Status" htmlFor="edit-status">
          <Select value={status} onValueChange={(v) => setStatus(v as TaskRow['status'])}>
            <SelectTrigger id="edit-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todo">To do</SelectItem>
              <SelectItem value="in_progress">In progress</SelectItem>
              <SelectItem value="done">Done</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Priority" htmlFor="edit-priority">
          <Select value={priority} onValueChange={(v) => setPriority(v as TaskRow['priority'])}>
            <SelectTrigger id="edit-priority">
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
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Due" htmlFor="edit-due">
          <Input id="edit-due" type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
        </Field>
        <Field label="Area" htmlFor="edit-area">
          <Select value={areaId} onValueChange={setAreaId}>
            <SelectTrigger id="edit-area">
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
      </div>

      <Field label="Project" htmlFor="edit-project">
        <Select value={projectId} onValueChange={setProjectId}>
          <SelectTrigger id="edit-project">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            {projects.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field
        label="Recurrence (RRULE)"
        htmlFor="edit-rrule"
        helper="Example: RRULE:FREQ=WEEKLY;BYDAY=MO — occurrences expand below; confirming creates one row each."
        error={rrule && !parseRRule(rrule) ? 'Invalid RRULE' : undefined}
      >
        <Input
          id="edit-rrule"
          value={rrule}
          onChange={(e) => setRRule(e.target.value.toUpperCase())}
          placeholder="RRULE:FREQ=WEEKLY"
        />
      </Field>

      {occurrences.length > 0 ? (
        <div className="rounded-xl border border-line bg-surface p-3">
          <p className="mb-1 text-xs font-medium text-muted">Next occurrences</p>
          <ul className="grid gap-1 font-mono text-xs tabular text-ink">
            {occurrences.map((d) => (
              <li key={d.toISOString()}>{formatDate(d)}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <div className="flex items-center gap-2">
        <Button onClick={() => void save()} disabled={busy}>
          {busy ? 'Saving…' : 'Save changes'}
        </Button>
        {saved ? <span className="text-sm text-grove">Saved</span> : null}
      </div>
    </div>
  );
}
