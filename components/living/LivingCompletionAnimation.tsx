'use client';

import * as React from 'react';
import { Check } from '@phosphor-icons/react';
import { cn } from '@/lib/utils/cn';

interface LivingCompletionAnimationProps {
  visible: boolean;
  tone?: 'amethyst' | 'gold' | 'cyan' | 'rose';
  className?: string;
}

export function LivingCompletionAnimation({
  visible,
  tone = 'gold',
  className,
}: LivingCompletionAnimationProps) {
  const colors: Record<string, string> = {
    amethyst: '#9678ff',
    gold: '#ffd36e',
    cyan: '#5fe6d6',
    rose: '#ff7c92',
  };

  return (
    <div
      className={cn(
        'pointer-events-none fixed inset-0 z-50 flex items-center justify-center',
        className,
      )}
      role="status"
      aria-live="polite"
    >
      {visible ? (
        <div
          className="living-fade flex flex-col items-center gap-3 rounded-3xl border bg-[#0f0d14] px-8 py-10 shadow-[0_0_30px_rgba(255,211,110,0.15)]"
          style={{ borderColor: `${colors[tone]}40` }}
        >
          <div
            className="flex h-14 w-14 items-center justify-center rounded-2xl text-3xl tabular-nums"
            style={{ background: `${colors[tone]}20`, color: colors[tone] }}
          >
            <Check size={32} weight="bold" />
          </div>

          <div className="flex flex-col gap-1 text-center">
            <p className="text-lg font-semibold text-ink">Mission complete</p>
            <p className="text-sm text-muted">Keep the momentum going.</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
