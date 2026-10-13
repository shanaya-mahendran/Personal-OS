import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AppShell } from '@/components/layout/AppShell';
import { ContextProvider } from '@/components/context/ContextProvider';

/**
 * App shell for all signed-in pages: fetches the profile + settings on the
 * server, then wires the client ContextProvider around the shell.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const [{ data: profile }, { data: settings }] = await Promise.all([
    supabase.from('profiles').select('display_name, timezone').eq('id', user.id).maybeSingle(),
    supabase
      .from('settings')
      .select('location_enabled, context_engine_enabled, theme')
      .eq('user_id', user.id)
      .maybeSingle(),
  ]);

  return (
    <ContextProvider locationEnabled={settings?.location_enabled ?? false}>
      <AppShell displayName={profile?.display_name ?? null}>{children}</AppShell>
    </ContextProvider>
  );
}
