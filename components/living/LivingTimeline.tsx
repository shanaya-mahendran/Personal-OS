'use client';

import * as React from 'react';
import { Check, MapPin, ArrowRight } from '@phosphor-icons/react';
import { cn } from '@/lib/utils/cn';

export type LivingTimelineKind =
  | 'fixed'
  | 'planned'
  | 'suggested'
  | 'completed'
  | 'unexpected';

export interface LivingTimelineEntry {
  id: string;
  kind: LivingTimelineKind;
  title: string;
  timeLabel: string;
  duration: string | null;
  location: string | null;
  completed?: boolean;
  accent?: 'amethyst' | 'gold' | 'cyan' | 'rose';
  note?: string;
}

interface LivingTimelineProps {
  entries: LivingTimelineEntry[];
  className?: string;
}

export function LivingTimeline({ entries, className }: LivingTimelineProps) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {entries.map((entry) => (
        <div key={entry.id} className="flex gap-3">
          <div
            className={cn(
              'mt-1.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs tabular-nums font-semibold',
              entry.kind === 'fixed' && 'bg-white/10 text-white',
              entry.kind === 'planned' && 'bg-[#9678ff]/20 text-[#9678ff]',
              entry.kind === 'suggested' && 'bg-[#5fe6d6]/20 text-[#5fe6d6]',
              entry.kind === 'completed' && 'bg-[#ffd36e]/20 text-[#ffd36e]',
              entry.kind === 'unexpected' && 'bg-[#ff7c92]/20 text-[#ff7c92]',
            )}
          >
            {entry.kind === 'completed' ? (
              <Check size={16} weight="bold" />
            ) : (
              <ArrowRight size={16} weight="bold" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink">{entry.title}</p>
                <p className="mt-0.5 text-xs text-muted">{entry.timeLabel}</p>
              </div>
              {entry.kind === 'completed' ? (
                <span className="shrink-0 text-[11px] tabular-nums text-[#ffd36e]">Done</span>
              ) : null}
            </div>

            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px]">
              {entry.duration ? (
                <span className="text-muted">{entry.duration}</span>
              ) : null}
              {entry.location ? (
                <span className="flex items-center gap-1 text-muted">
                  <MapPin size={11} />
                  {entry.location}
                </span>
              ) : null}
              {entry.note ? (
                <span className="text-muted">{entry.note}</span>
              ) : null}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
