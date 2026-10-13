'use client';

import * as React from 'react';
import { LivingAccentBar } from '@/components/living/LivingAccentBar';
import { cn } from '@/lib/utils/cn';

interface LivingHeroProps {
  date: string;
  greeting: string;
  summary: string | null;
  tone?: 'amethyst' | 'gold' | 'cyan' | 'rose';
  className?: string;
}

export function LivingHero({
  date,
  greeting,
  summary,
  tone = 'amethyst',
  className,
}: LivingHeroProps) {
  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-widest text-muted">{date}</p>
          <h1 className="living-display mt-1 text-2xl sm:text-3xl text-ink">
            {greeting}
          </h1>
        </div>
        <LivingAccentBar tone={tone} size="med" />
      </div>

      {summary ? (
        <p className="text-sm leading-relaxed text-muted">{summary}</p>
      ) : (
        <p className="text-sm text-muted">Not enough data to build a summary yet.</p>
      )}

      <LivingAccentBar tone={tone} className="mt-1" />
    </div>
  );
}
