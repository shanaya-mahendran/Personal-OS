import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { SettingsView, type SettingsData } from '@/components/settings/SettingsView';

export const dynamic = 'force-dynamic';

/**
 * Settings: profile, context engine, location privacy (off by default),
 * theme, notification preferences, known places (spec §7 privacy rules).
 */
export default async function SettingsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [profileRes, settingsRes, placesRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
    supabase.from('settings').select('*').eq('user_id', user.id).maybeSingle(),
    supabase
      .from('known_places')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }),
  ]);

  const data: SettingsData = {
    email: user.email ?? '',
    profile: profileRes.data,
    settings: settingsRes.data,
    places: placesRes.data ?? [],
  };

  return <SettingsView data={data} />;
}
