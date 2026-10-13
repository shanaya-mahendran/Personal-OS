'use client';

/**
 * TodayTasks: 44px rows, round checkbox, priority as a 3px left edge,
 * area tag as a hairline chip. Completed: strikethrough + dim.
 */
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toggleTask } from '@/lib/actions/tasks';
import { Card, CardContent, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/field';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils/cn';

export interface TaskItem {
  id: string;
  title: string;
  status: string;
  priority: string;
  due_at: string | null;
  area_name?: string | null;
}

const PRIORITY_EDGE: Record<string, string> = {
  urgent: 'border-l-[3px] border-danger',
  high: 'border-l-[3px] border-warning',
  medium: 'border-l-[3px] border-line',
  low: 'border-l-[3px] border-transparent',
};

export function TodayTasks({
  tasks,
  loading,
  onCapture,
}: {
  tasks: TaskItem[];
  loading?: boolean;
  onCapture?: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<string | null>(null);

  if (loading) {
    return (
      <Card>
        <CardContent>
          <Skeleton className="mb-3 h-4 w-24" />
          <div className="grid gap-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-11 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  async function toggle(id: string, done: boolean) {
    setBusy(id);
    await toggleTask(id, done);
    setBusy(null);
    router.refresh();
  }

  return (
    <Card>
      <CardContent>
        <div className="mb-1 flex items-baseline justify-between">
          <CardTitle>Today&apos;s tasks</CardTitle>
          <button
            type="button"
            onClick={() => router.push('/tasks')}
            className="text-[11px] font-medium text-muted hover:text-ink"
          >
            All tasks
          </button>
        </div>

        {tasks.length === 0 ? (
          <EmptyState
            message="No tasks for today. Capture something below."
            action={
              onCapture ? (
                <button
                  type="button"
                  onClick={onCapture}
                  className="text-sm font-medium text-grove underline-offset-4 hover:underline"
                >
                  Quick capture
                </button>
              ) : null
            }
          />
        ) : (
          <ul className="hairline-divide">
            {tasks.map((task) => {
              const done = task.status === 'done';
              return (
                <li
                  key={task.id}
                  className={cn(
                    'flex min-h-[44px] items-center gap-3 py-1.5 pl-3 pr-1',
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
                    className={cn(
                      'flex-1 truncate text-left text-sm',
                      done ? 'text-muted line-through' : 'text-ink',
                    )}
                  >
                    {task.title}
                  </button>
                  {task.area_name ? (
                    <span className="hidden shrink-0 rounded-full border border-line px-2 py-0.5 text-[10px] text-muted sm:block">
                      {task.area_name}
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
