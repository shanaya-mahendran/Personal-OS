'use client';

import * as React from 'react';
import { cn } from '@/lib/utils/cn';

type AccentTone = 'amethyst' | 'gold' | 'cyan' | 'rose';

interface LivingAccentBarProps {
  tone?: AccentTone;
  className?: string;
  size?: 'hair' | 'med';
}

export function LivingAccentBar({
  tone = 'amethyst',
  className,
  size = 'hair',
}: LivingAccentBarProps) {
  const colors: Record<AccentTone, string> = {
    amethyst: 'box-shadow: 0 0 10px rgba(150,120,255,0.6); background: #9678ff;',
    gold: 'box-shadow: 0 0 10px rgba(255,211,110,0.6); background: #ffd36e;',
    cyan: 'box-shadow: 0 0 10px rgba(95,230,214,0.6); background: #5fe6d6;',
    rose: 'box-shadow: 0 0 10px rgba(255,124,146,0.6); background: #ff7c92;',
  };

  return (
    <div
      className={cn('mx-0 whitespace-pre-wrap tabular-nums', className)}
      style={{
        height: size === 'med' ? '6px' : '3px',
        ...(colors[tone] as React.CSSProperties),
        borderRadius: '999px',
      }}
      suppressHydrationWarning
    />
  );
}
