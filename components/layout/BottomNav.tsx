'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { DotsThree, type IconProps } from '@phosphor-icons/react';
import { cn } from '@/lib/utils/cn';

export interface TabDef {
  href: string;
  label: string;
  icon: React.ComponentType<IconProps>;
}

/** Bottom tab bar: max 5 items, height ≤ 72px (design §5). */
export function BottomNav({ tabs }: { tabs: readonly TabDef[] }) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = React.useState(false);

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  const moreLinks = [
    { href: '/inbox', label: 'Inbox' },
    { href: '/projects', label: 'Projects' },
    { href: '/prayers', label: 'Prayers' },
    { href: '/career', label: 'Career' },
    { href: '/volunteering', label: 'Volunteering' },
    { href: '/branding', label: 'Branding' },
    { href: '/karate', label: 'Karate' },
    { href: '/family', label: 'Family' },
    { href: '/eating', label: 'Eating' },
  ];

  return (
    <>
      {moreOpen ? (
        <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setMoreOpen(false)}>
          <div
            className="absolute inset-x-0 bottom-0 mx-auto max-w-[480px] rounded-t-2xl border-t border-line bg-surface p-4 pb-8"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="mb-3 text-xs font-medium uppercase tracking-widest text-muted">
              Everything else
            </p>
            <div className="grid grid-cols-3 gap-2">
              {moreLinks.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setMoreOpen(false)}
                  className={cn(
                    'rounded-xl border border-line px-3 py-3 text-center text-sm font-medium',
                    isActive(l.href) ? 'bg-grove-tint text-grove' : 'text-ink',
                  )}
                >
                  {l.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto flex h-[68px] w-full max-w-[480px] items-stretch px-2 lg:max-w-[720px]">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = isActive(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  'flex flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors',
                  active ? 'text-grove' : 'text-muted hover:text-ink',
                )}
                aria-current={active ? 'page' : undefined}
              >
                <Icon size={20} weight={active ? 'fill' : 'duotone'} />
                {tab.label}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setMoreOpen((v) => !v)}
            className={cn(
              'flex flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors',
              moreOpen ? 'text-grove' : 'text-muted hover:text-ink',
            )}
            aria-expanded={moreOpen}
          >
            <DotsThree size={20} weight="duotone" />
            More
          </button>
        </div>
      </nav>
    </>
  );
}
