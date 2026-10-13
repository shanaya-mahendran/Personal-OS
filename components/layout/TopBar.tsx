'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { Gear, SignOut, Bell, Question } from '@phosphor-icons/react';
import { createClient } from '@/lib/supabase/client';
import { useContextEngine } from '@/components/context/ContextProvider';
import { CONTEXT_LABELS, CONTEXT_STATES, type ContextState } from '@/lib/context/states';
import { useContextStore } from '@/lib/stores/app-store';
import { getDynamicGreeting } from '@/lib/utils/greetings';
import { browserTimeZone } from '@/lib/utils/dates';
import { cn } from '@/lib/utils/cn';

/**
 * Top bar: greeting + context chip (the "dynamic island" from design §4).
 * UNKNOWN renders as a neutral dot labeled "Unsure" — never a guess.
 * When context is unsure or in the sleep window, a "What are you doing?"
 * prompt lets the user manually set the active context.
 */
export function TopBar({ displayName }: { displayName?: string | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const { result } = useContextEngine();
  const { manualOverride, setManualOverride } = useContextStore();
  const [now, setNow] = React.useState(() => new Date());
  const [expanded, setExpanded] = React.useState(false);
  const [askingActivity, setAskingActivity] = React.useState(false);

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

  const timezone = browserTimeZone();
  const hasActiveTask =
    result?.source === 'activity' ||
    (result?.context !== 'UNKNOWN' && result?.source !== 'none');

  const greeting = getDynamicGreeting({
    date: now,
    timezone,
    context: result?.context ?? null,
    hasActiveTask,
    displayName,
  });

  const label = manualOverride
    ? CONTEXT_LABELS[manualOverride]
    : result
      ? CONTEXT_LABELS[result.context]
      : 'Unsure';

  const isUnknown = !manualOverride && (!result || result.context === 'UNKNOWN');
  const isPrompt = result?.source === 'prompt'; // "Working late · Tap to set activity"
  const showChip = !pathname.startsWith('/settings') && !pathname.startsWith('/login');

  // Show "What are you doing?" when context is unknown or it's a late-night prompt
  const showActivityPrompt = isUnknown || isPrompt;

  function handleChipClick() {
    if (showActivityPrompt) {
      setAskingActivity((v) => !v);
    } else {
      setExpanded((v) => !v);
    }
  }

  function selectActivity(state: ContextState) {
    setManualOverride(state);
    setAskingActivity(false);
  }

  function clearOverride() {
    setManualOverride(null);
    setAskingActivity(false);
    setExpanded(false);
  }

  // States a user can manually set (excluding UNKNOWN / SLEEPING which are inferred)
  const pickableStates = CONTEXT_STATES.filter(
    (s) => s !== 'UNKNOWN' && s !== 'SLEEPING',
  );

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-canvas/90 backdrop-blur-sm">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-[13px] text-muted">
            {greeting}
            {displayName ? `, ${displayName}` : ''}
          </p>
          {showChip ? (
            <button
              type="button"
              id="context-chip"
              onClick={handleChipClick}
              className={cn(
                'mt-1 flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-medium transition-colors',
                isUnknown || isPrompt
                  ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400'
                  : 'bg-black/[0.04] text-ink dark:bg-white/[0.06]',
              )}
              aria-expanded={askingActivity || expanded}
              aria-label={isUnknown ? 'What are you doing? Set activity' : `Context: ${label}`}
            >
              <span
                className={cn(
                  'h-1.5 w-1.5 rounded-full',
                  isUnknown || isPrompt ? 'bg-amber-400' : 'bg-grove',
                )}
              />
              {isUnknown || isPrompt ? (
                <>
                  <Question size={11} className="shrink-0" />
                  What are you doing?
                </>
              ) : (
                <>
                  {label}
                  {result && result.source !== 'none' ? (
                    <span className="tabular font-mono text-[10px] text-muted">
                      {Math.round(result.confidence * 100)}%
                    </span>
                  ) : null}
                </>
              )}
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

      {/* Activity picker — shown when user taps "What are you doing?" */}
      {askingActivity && (
        <div className="border-t border-line px-4 py-3">
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted">
            What are you doing right now?
          </p>
          <div className="flex flex-wrap gap-1.5">
            {pickableStates.map((state) => (
              <button
                key={state}
                type="button"
                id={`activity-pick-${state.toLowerCase()}`}
                onClick={() => selectActivity(state)}
                className={cn(
                  'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                  manualOverride === state
                    ? 'border-grove bg-grove text-white'
                    : 'border-line bg-canvas text-ink hover:bg-black/[0.04] dark:hover:bg-white/[0.06]',
                )}
              >
                {CONTEXT_LABELS[state]}
              </button>
            ))}
            {manualOverride && (
              <button
                type="button"
                id="activity-clear"
                onClick={clearOverride}
                className="rounded-full border border-dashed border-line px-3 py-1 text-xs text-muted transition-colors hover:text-ink"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}

      {/* Context detail panel — shown when chip is tapped and context IS known */}
      {expanded && result && !isUnknown && !askingActivity ? (
        <div className="border-t border-line px-4 py-3 text-xs text-muted">
          <p className="text-ink">{CONTEXT_LABELS[result.context]}</p>
          <p className="mt-1">
            {result.label}
            {result.time_match ? ' · time matches' : ''}
            {result.location_match ? ' · location matches' : ''}
          </p>
          {manualOverride && (
            <button
              type="button"
              id="context-clear-manual"
              onClick={clearOverride}
              className="mt-2 text-[11px] text-muted underline"
            >
              Clear manual override
            </button>
          )}
        </div>
      ) : null}
    </header>
  );
}
