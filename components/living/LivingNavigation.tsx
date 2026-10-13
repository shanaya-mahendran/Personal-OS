'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { DotsThree, House, Trophy, Target, Plus, Sparkle } from '@phosphor-icons/react';
import { cn } from '@/lib/utils/cn';

const TABS = [
  { href: '/living', label: 'Today', icon: House },
  { href: '/living/campaigns', label: 'Campaigns', icon: Trophy },
  { href: '/living/quests', label: 'Quests', icon: Target },
  { href: '/living/replan', label: 'Replan', icon: Sparkle },
] as const;

export function LivingNavigation() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = React.useState(false);

  const active = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  return (
    <>
      {moreOpen ? (
        <div
          className="fixed inset-0 z-50 bg-black/40"
          onClick={() => setMoreOpen(false)}
        >
          <div
            className="absolute bottom-0 mx-auto max-w-[480px] rounded-t-3xl border-t border-white/10 bg-[#0f0d14] p-4 pb-8"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="mb-3 text-xs font-medium uppercase tracking-widest text-white/50">
              More
            </p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { href: '/living/progress', label: 'Progress' },
                { href: '/living/history', label: 'History' },
                { href: '/living/settings', label: 'Settings' },
              ].map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setMoreOpen(false)}
                  className={cn(
                    'rounded-xl border border-white/10 px-3 py-3 text-center text-sm text-white/80',
                    active(l.href) ? 'bg-white/10 text-white' : 'hover:bg-white/5',
                  )}
                >
                  {l.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-[#0f0d14]/95 backdrop-blur">
        <div className="mx-auto flex h-[72px] w-full max-w-[480px] items-stretch px-2">
          {TABS.map(({ href, label, icon: Icon }) => {
            const activeTab = active(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors',
                  activeTab ? 'text-[#9678ff]' : 'text-white/50 hover:text-white/80',
                )}
                aria-current={activeTab ? 'page' : undefined}
              >
                <Icon size={20} weight={activeTab ? 'fill' : 'duotone'} />
                {label}
              </Link>
            );
          })}

          <button
            type="button"
            onClick={() => setMoreOpen((v) => !v)}
            className={cn(
              'flex flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors',
              moreOpen ? 'text-[#9678ff]' : 'text-white/50 hover:text-white/80',
            )}
            aria-expanded={moreOpen}
          >
            <DotsThree size={20} weight="duotone" />
            More
          </button>
        </div>
      </nav>

      <button
        type="button"
        className="fixed right-4 top-1/2 z-40 -translate-y-1/2 flex h-12 w-12 items-center justify-center rounded-full bg-[#ffd36e] shadow-[0_0_18px_rgba(255,211,110,0.6)] transition-transform active:scale-95"
        aria-label="Quick capture"
      >
        <Plus size={22} weight="bold" className="text-black" />
      </button>
    </>
  );
}
