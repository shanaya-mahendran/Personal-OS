'use client';

import * as React from 'react';
import { cn } from '@/lib/utils/cn';

interface LivingProgressRingProps {
  progress: number;
  className?: string;
  size?: number;
  tone?: 'amethyst' | 'gold' | 'cyan' | 'rose';
  label?: string;
}

export function LivingProgressRing({
  progress,
  className,
  size = 56,
  tone = 'amethyst',
  label,
}: LivingProgressRingProps) {
  const colors: Record<string, string> = {
    amethyst: '#9678ff',
    gold: '#ffd36e',
    cyan: '#5fe6d6',
    rose: '#ff7c92',
  };

  const pct = Math.max(0, Math.min(100, progress));
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const filled = (pct / 100) * circ;

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <svg
        width={size}
        height={size}
        className="tabular-nums"
        aria-hidden="true"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="4"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={colors[tone]}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ - filled}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ filter: `drop-shadow(0 0 6px ${colors[tone]})` }}
        />
      </svg>
      {label ? (
        <div className="flex flex-col">
          <span className="text-sm font-medium text-ink">{label}</span>
          <span className="text-xs tabular-nums text-muted">{Math.round(pct)}%</span>
        </div>
      ) : null}
    </div>
  );
}
