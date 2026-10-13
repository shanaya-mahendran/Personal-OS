'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { Gear, SignOut, Bell } from '@phosphor-icons/react';
import { createClient } from '@/lib/supabase/client';
import { useContextEngine } from '@/components/context/ContextProvider';
import { CONTEXT_LABELS } from '@/lib/context/states';
import { cn } from '@/lib/utils/cn';

function greetingFor(hour: number): string {
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  if (hour < 21) return 'Good evening';
  return 'Wind down';
}

/**
 * Top bar: greeting + context chip (the "dynamic island" from design §4).
 * UNKNOWN renders as a neutral dot labeled "Unsure" — never a guess.
 */
export function TopBar({ displayName }: { displayName?: string | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const { result } = useContextEngine();
  const [now, setNow] = React.useState(() => new Date());
  const [expanded, setExpanded] = React.useState(false);

  React.useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  const label = result ? CONTEXT_LABELS[result.context] : 'Unsure';
  const isUnknown = !result || result.context === 'UNKNOWN';
  const showChip = !pathname.startsWith('/settings') && !pathname.startsWith('/login');

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-canvas/90 backdrop-blur-sm">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-[13px] text-muted">
            {greetingFor(now.getHours())}
            {displayName ? `, ${displayName}` : ''}
          </p>
          {showChip ? (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="mt-1 flex items-center gap-2 rounded-full bg-black/[0.04] px-2.5 py-1 text-xs font-medium text-ink transition-colors dark:bg-white/[0.06]"
              aria-expanded={expanded}
            >
              <span
                className={cn(
                  'h-1.5 w-1.5 rounded-full',
                  isUnknown ? 'bg-muted' : 'bg-grove',
                )}
              />
              {label}
              {result && result.source !== 'none' ? (
                <span className="tabular font-mono text-[10px] text-muted">
                  {Math.round(result.confidence * 100)}%
                </span>
              ) : null}
            </button>
          ) : (
            <p className="mt-1 text-sm font-semibold tracking-tight">Settings</p>
          )}
        </div>

        <div className="flex items-center gap-1">
          <Link
            href="/settings"
            aria-label="Notifications"
            className="rounded-full p-2 text-muted transition-colors hover:bg-black/[0.05] hover:text-ink dark:hover:bg-white/10"
          >
            <Bell size={18} weight="duotone" />
          </Link>
          <Link
            href="/settings"
            aria-label="Settings"
            className="rounded-full p-2 text-muted transition-colors hover:bg-black/[0.05] hover:text-ink dark:hover:bg-white/10"
          >
            <Gear size={18} weight="duotone" />
          </Link>
          <button
            type="button"
            onClick={() => void signOut()}
            aria-label="Sign out"
            className="rounded-full p-2 text-muted transition-colors hover:bg-black/[0.05] hover:text-ink dark:hover:bg-white/10"
          >
            <SignOut size={18} weight="duotone" />
          </button>
        </div>
      </div>

      {expanded && result ? (
        <div className="border-t border-line px-4 py-3 text-xs text-muted">
          <p className="text-ink">{CONTEXT_LABELS[result.context]}</p>
          <p className="mt-1">
            {result.context === 'UNKNOWN'
              ? "I don't have enough context right now."
              : `${result.label}${result.time_match ? ' · time matches' : ''}${
                  result.location_match ? ' · location matches' : ''
                }`}
          </p>
        </div>
      ) : null}
    </header>
  );
}
