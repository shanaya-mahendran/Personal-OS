'use client';

import * as React from 'react';
import { Check, Trophy, Clock } from '@phosphor-icons/react';
import { formatDuration } from '@/lib/utils/format';
import { LivingAccentBar } from '@/components/living/LivingAccentBar';
import { cn } from '@/lib/utils/cn';

export interface LivingQuestView {
  id: string;
  title: string;
  subtitle: string | null;
  outcome: string | null;
  estMinutes: number | null;
  priority: 'main' | 'side' | 'emergent' | 'routine';
  campaignId: string | null;
  campaignTitle: string | null;
  progressPct: number;
  accent: 'amethyst' | 'gold' | 'cyan' | 'rose';
  dueLabel: string | null;
}

interface LivingMissionCardProps {
  quest: LivingQuestView;
  selected: boolean;
  onSelect: () => void;
  onStart: () => void;
  className?: string;
}

export function LivingMissionCard({
  quest,
  selected,
  onSelect,
  onStart,
  className,
}: LivingMissionCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'living-bezel w-full text-left transition-transform active:scale-[0.99] hover:living-bezel-glow',
        selected && 'living-bezel-glow',
        className,
      )}
    >
      <LivingAccentBar tone={quest.accent} className="mb-3" />

      <div className="flex items-start gap-3">
        <div
          className={cn(
            'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-lg tabular-nums',
            quest.priority === 'main' ? 'bg-[#9678ff]/20 text-[#9678ff]' : 'bg-white/[0.04] text-white/[0.7]',
          )}
        >
          {quest.priority === 'main' ? (
            <Trophy size={20} weight="fill" />
          ) : quest.priority === 'side' ? (
            <Check size={20} weight="bold" />
          ) : (
            <Clock size={20} weight="duotone" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-ink">{quest.title}</p>
              {quest.subtitle ? (
                <p className="mt-0.5 text-xs text-muted">{quest.subtitle}</p>
              ) : null}
            </div>
            {quest.dueLabel ? (
              <span className="shrink-0 text-[11px] tabular-nums text-muted">
                {quest.dueLabel}
              </span>
            ) : null}
          </div>

          {quest.campaignTitle ? (
            <p className="mt-1 text-[11px] text-muted">
              Belongs to <span className="text-[#9678ff]">{quest.campaignTitle}</span>
            </p>
          ) : null}

          <div className="mt-3 flex items-center gap-3">
            {quest.estMinutes ? (
              <span className="flex items-center gap-1 text-xs text-muted">
                <Clock size={12} />
                {formatDuration(quest.estMinutes * 60)}
              </span>
            ) : null}

            {quest.priority === 'main' && quest.progressPct > 0 ? (
              <span className="text-[11px] tabular-nums text-[#9678ff]">
                {Math.round(quest.progressPct)}%
              </span>
            ) : null}

            <div className="ml-auto flex items-center gap-1">
              <span className="text-[11px] text-muted">{quest.outcome ?? 'Start'}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onStart();
          }}
          className={cn(
            'rounded-full bg-[#9678ff] px-4 py-1.5 text-xs font-semibold text-white transition-transform active:scale-95 hover:brightness-110',
            quest.priority === 'main' ? 'bg-[#9678ff]' : 'bg-white/10 text-white/80',
          )}
        >
          {selected ? 'Working on it' : 'Start mission'}
        </button>
      </div>
    </button>
  );
}
