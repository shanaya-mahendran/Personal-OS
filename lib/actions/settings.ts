'use server';

/**
 * Settings actions: profile, context engine, location privacy, theme,
 * notification preferences, known places (geofences).
 */
import { z } from 'zod';
import { ActionError, errorMessage, revalidateApp, requireContext } from './helpers';

export interface SettingsResult<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}

const ProfileSchema = z.object({
  display_name: z.string().trim().min(1).max(120),
  timezone: z.string().min(1).max(80),
});

export async function updateProfile(input: unknown): Promise<SettingsResult> {
  try {
    const parsed = ProfileSchema.parse(input);
    const { supabase, userId } = await requireContext();
    const { error } = await supabase.from('profiles').update(parsed).eq('id', userId);
    if (error) throw new ActionError(error.message);
    revalidateApp(['/dashboard', '/settings']);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

const SettingsSchema = z.object({
  context_engine_enabled: z.boolean().optional(),
  location_enabled: z.boolean().optional(),
  theme: z.enum(['light', 'dark', 'system']).optional(),
  notification_prefs: z.record(z.string(), z.unknown()).optional(),
  dashboard_prefs: z.record(z.string(), z.unknown()).optional(),
});

export async function updateSettings(input: unknown): Promise<SettingsResult> {
  try {
    const parsed = SettingsSchema.parse(input);
    const { supabase, userId } = await requireContext();
    const { error } = await supabase
      .from('settings')
      .update(parsed as Record<string, never>)
      .eq('user_id', userId);
    if (error) throw new ActionError(error.message);
    revalidateApp(['/dashboard', '/settings']);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

const PlaceSchema = z.object({
  name: z.string().trim().min(1).max(120),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  radius_m: z.coerce.number().int().min(10).max(5000).default(150),
  context_hint: z.string().max(120).nullable().optional(),
});

export async function addKnownPlace(input: unknown): Promise<SettingsResult<{ id: string }>> {
  try {
    const parsed = PlaceSchema.parse(input);
    const { supabase, userId } = await requireContext();
    const { data, error } = await supabase
      .from('known_places')
      .insert({ ...parsed, user_id: userId })
      .select('id')
      .single();
    if (error) throw new ActionError(error.message);
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

export async function removeKnownPlace(id: string): Promise<SettingsResult> {
  try {
    const { supabase, userId } = await requireContext();
    const { error } = await supabase
      .from('known_places')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);
    if (error) throw new ActionError(error.message);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}
