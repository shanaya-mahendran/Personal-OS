'use client';

/**
 * AppShell: top bar + content + bottom tab navigation.
 * Dashboard is the first tab; capture is reachable everywhere via the FAB.
 */
import * as React from 'react';
import { usePathname } from 'next/navigation';
import {
  House,
  ListChecks,
  CalendarBlank,
  Sparkle,
  Plus,
  Camera,
  NotePencil,
} from '@phosphor-icons/react';
import { TopBar } from '@/components/layout/TopBar';
import { BottomNav } from '@/components/layout/BottomNav';
import { CaptureSheet } from '@/components/capture/CaptureSheet';
import { useCaptureStore } from '@/lib/stores/app-store';
import { cn } from '@/lib/utils/cn';

const TABS = [
  { href: '/dashboard', label: 'Today', icon: House },
  { href: '/tasks', label: 'Tasks', icon: ListChecks },
  { href: '/calendar', label: 'Calendar', icon: CalendarBlank },
  { href: '/assistant', label: 'Ask', icon: Sparkle },
] as const;

export function AppShell({
  children,
  displayName,
}: {
  children: React.ReactNode;
  displayName?: string | null;
}) {
  const pathname = usePathname();
  const [fabOpen, setFabOpen] = React.useState(false);
  const [sheet, setSheet] = React.useState<'text' | 'image' | null>(null);
  const openPreview = useCaptureStore((s) => s.openPreview);

  // Close transient UI on navigation.
  React.useEffect(() => {
    setFabOpen(false);
  }, [pathname]);

  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-[480px] flex-col bg-canvas lg:max-w-[720px]">
      <TopBar displayName={displayName} />

      <main className="flex-1 px-4 pb-32 pt-4">{children}</main>

      {/* Floating capture speed-dial: the only elevated element. */}
      <div className="fixed bottom-24 right-4 z-40 flex flex-col items-end gap-3 lg:right-[max(1.5rem,calc((100vw-720px)/2))]">
        {fabOpen ? (
          <>
            <button
              type="button"
              onClick={() => {
                setSheet('text');
                openPreview(null);
              }}
              className="flex h-11 items-center gap-2 rounded-full border border-line bg-surface px-4 text-sm font-medium shadow-lg"
            >
              <NotePencil size={16} weight="duotone" /> Text
            </button>
            <button
              type="button"
              onClick={() => {
                setSheet('image');
                openPreview(null);
              }}
              className="flex h-11 items-center gap-2 rounded-full border border-line bg-surface px-4 text-sm font-medium shadow-lg"
            >
              <Camera size={16} weight="duotone" /> Camera
            </button>
          </>
        ) : null}
        <button
          type="button"
          aria-label="Capture something"
          aria-expanded={fabOpen}
          onClick={() => setFabOpen((v) => !v)}
          className={cn(
            'flex h-14 w-14 items-center justify-center rounded-full bg-grove text-white shadow-xl transition-transform active:scale-95 dark:text-black',
            fabOpen && 'rotate-45',
          )}
        >
          <Plus size={24} weight="bold" />
        </button>
      </div>

      <CaptureSheet mode={sheet} onClose={() => setSheet(null)} />

      <BottomNav tabs={TABS} />
    </div>
  );
}
