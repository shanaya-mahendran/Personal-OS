import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

/**
 * Landing: signed-in users go to the dashboard, everyone else to /login.
 */
export default async function Home() {
  // Without Supabase env (fresh clone / CI) send the user to login instead of
  // failing the render — configuration errors surface there, not as a 500.
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    redirect(user ? '/dashboard' : '/login');
  } catch {
    redirect('/login');
  }
}
