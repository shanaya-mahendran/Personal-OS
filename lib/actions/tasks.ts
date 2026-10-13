'use server';

/**
 * Task & project server actions.
 * All payloads are re-validated with Zod inside the action (never trust the
 * client), and every mutation writes an audit row.
 */
import { z } from 'zod';
import type { TaskRow } from '@/lib/supabase/types';
import {
  TaskCreateSchema,
  TaskUpdateSchema,
  ProjectCreateSchema,
  completionFields,
} from '@/lib/validation/task';
import {
  ActionError,
  audit,
  errorMessage,
  revalidateApp,
  requireContext,
} from './helpers';

export interface ActionResult<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}

export async function createTask(input: unknown): Promise<ActionResult> {
  try {
    const parsed = TaskCreateSchema.parse(input);
    const { supabase, userId } = await requireContext();
    const { data, error } = await supabase
      .from('tasks')
      .insert({ ...parsed, user_id: userId })
      .select()
      .single();
    if (error) throw new ActionError(error.message);
    await audit(supabase, userId, {
      action: 'create',
      entity_type: 'task',
      entity_id: data.id,
      payload: { title: data.title, source: 'user' },
    });
    revalidateApp(['/dashboard', '/tasks']);
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

export async function updateTask(input: unknown): Promise<ActionResult> {
  try {
    const { id, ...rest } = TaskUpdateSchema.parse(input);
    const { supabase, userId } = await requireContext();
    const patch: Partial<TaskRow> = { ...rest };
    if (rest.status === 'done') patch.completed_at = new Date().toISOString();
    if (rest.status && rest.status !== 'done') patch.completed_at = null;

    const { data, error } = await supabase
      .from('tasks')
      .update(patch)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();
    if (error) throw new ActionError(error.message);
    await audit(supabase, userId, {
      action: 'update',
      entity_type: 'task',
      entity_id: id,
      payload: { fields: Object.keys(rest) },
    });
    revalidateApp(['/dashboard', '/tasks', `/tasks/${id}`]);
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

/** One-tap completion toggle used by task rows. */
export async function toggleTask(id: string, done: boolean): Promise<ActionResult> {
  try {
    const { supabase, userId } = await requireContext();
    const fields = completionFields(done ? 'done' : 'todo');
    const { data, error } = await supabase
      .from('tasks')
      .update(fields)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();
    if (error) throw new ActionError(error.message);
    await audit(supabase, userId, {
      action: done ? 'complete' : 'reopen',
      entity_type: 'task',
      entity_id: id,
    });
    revalidateApp(['/dashboard', '/tasks']);
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

/** User-initiated delete (the AI is never given this tool). */
export async function deleteTask(id: string): Promise<ActionResult> {
  try {
    const { supabase, userId } = await requireContext();
    const { error } = await supabase.from('tasks').delete().eq('id', id).eq('user_id', userId);
    if (error) throw new ActionError(error.message);
    await audit(supabase, userId, { action: 'delete', entity_type: 'task', entity_id: id });
    revalidateApp(['/dashboard', '/tasks']);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

export async function createProject(input: unknown): Promise<ActionResult> {
  try {
    const parsed = ProjectCreateSchema.parse(input);
    const { supabase, userId } = await requireContext();
    const { data, error } = await supabase
      .from('projects')
      .insert({ ...parsed, user_id: userId })
      .select()
      .single();
    if (error) throw new ActionError(error.message);
    await audit(supabase, userId, {
      action: 'create',
      entity_type: 'project',
      entity_id: data.id,
      payload: { title: data.title },
    });
    revalidateApp(['/projects']);
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

export async function updateProject(input: unknown): Promise<ActionResult> {
  try {
    const { id, ...rest } = ProjectCreateSchema.partial()
      .extend({ id: z.string().uuid() })
      .parse(input);
    const { supabase, userId } = await requireContext();
    const { data, error } = await supabase
      .from('projects')
      .update(rest)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();
    if (error) throw new ActionError(error.message);
    await audit(supabase, userId, {
      action: 'update',
      entity_type: 'project',
      entity_id: id,
    });
    revalidateApp(['/projects', `/projects/${id}`]);
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}
