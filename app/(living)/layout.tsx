import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { LivingNavigation } from '@/components/living/LivingNavigation';

export const dynamic = 'force-dynamic';

export default async function LivingLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  return (
    <div
      style={{
        background: 'radial-gradient(1200px 600px at 80% -10%, rgba(150,120,255,0.18), transparent 60%), radial-gradient(900px 500px at 0% 100%, rgba(95,230,214,0.10), transparent 60%), #07060a',
      }}
    >
      <div className="mx-auto flex min-h-[100dvh] flex-col bg-[#07060a] text-white">
        {children}
        <LivingNavigation />
      </div>
    </div>
  );
}
