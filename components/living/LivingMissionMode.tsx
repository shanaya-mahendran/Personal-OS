'use client';

import * as React from 'react';
import { Check, Trophy, ArrowRight, X } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  LivingAccentBar,
  LivingTimer,
  LivingProgressRing,
} from '@/components/living';
import { cn } from '@/lib/utils/cn';

export interface MissionSessionView {
  id: string;
  title: string;
  subtitle: string | null;
  objective: string | null;
  notes: string | null;
  estMinutes: number | null;
  campaignTitle: string | null;
  outcome: string | null;
  accent: 'amethyst' | 'gold' | 'cyan' | 'rose';
}

interface LivingMissionModeProps {
  session: MissionSessionView;
  elapsedMs: number;
  running: boolean;
  completed: boolean;
  onComplete: (outcome: string) => void;
  onExit: () => void;
  onTimerToggle: (next: { running: boolean; elapsedMs: number }) => void;
  className?: string;
}

export function LivingMissionMode({
  session,
  elapsedMs,
  running,
  completed,
  onComplete,
  onExit,
  onTimerToggle,
  className,
}: LivingMissionModeProps) {
  const [outcome, setOutcome] = React.useState('');
  const estSeconds = (session.estMinutes ?? 0) * 60;
  const progress = estSeconds > 0 ? Math.min(100, (elapsedMs / 1000) / estSeconds * 100) : 0;

  return (
    <div className={cn('flex flex-col gap-5', className)}>
      {session.accent && <LivingAccentBar tone={session.accent} size="med" />}

      <div className="grid gap-1">
        <p className="text-[11px] uppercase tracking-widest text-muted">Mission mode</p>
        <h2 className="living-display text-2xl text-ink">{session.title}</h2>
        {session.subtitle ? (
          <p className="text-sm text-muted">{session.subtitle}</p>
        ) : null}
        {session.campaignTitle ? (
          <p className="text-[11px] text-muted">
            Part of <span className="text-[#9678ff]">{session.campaignTitle}</span>
          </p>
        ) : null}
      </div>

      <div className="grid gap-3">
        <p className="text-[11px] uppercase tracking-widest text-muted">Objective</p>
        <p className="text-sm text-ink">
          {session.objective ?? 'Complete the mission and record the outcome.'}
        </p>
      </div>

      <LivingTimer
        totalSeconds={estSeconds}
        running={running}
        onChange={onTimerToggle}
        accent={session.accent}
      />

      <LivingProgressRing progress={progress} tone={session.accent} label="Session progress" />

      {session.notes ? (
        <div className="grid gap-2">
          <p className="text-[11px] uppercase tracking-widest text-muted">Resources / notes</p>
          <Textarea readOnly value={session.notes} className="h-24 resize-none" />
        </div>
      ) : null}

      {completed ? (
        <div className="grid gap-4 rounded-2xl border border-[#ffd36e]/40 bg-[#ffd36e]/8 p-5 text-center">
          <div className="flex items-center justify-center gap-2 text-[#ffd36e]">
            <Trophy size={28} weight="fill" />
            <span className="text-lg font-semibold text-ink">Mission complete</span>
          </div>

          <div className="flex flex-col items-center gap-2">
            <textarea
              value={outcome}
              onChange={(e) => setOutcome(e.target.value)}
              placeholder="What did you accomplish?"
              className="h-24 w-full resize-none rounded-xl border border-line bg-surface p-3 text-sm text-ink placeholder:text-muted"
            />
          </div>

          <div className="flex gap-2 justify-center">
            <Button variant="secondary" onClick={onExit}>
              Exit mission
            </Button>
            <Button
              onClick={() => onComplete(outcome || 'Completed the mission')}
              disabled={!outcome.trim()}
            >
              <Check size={16} /> Record outcome
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex gap-3 justify-end">
          <Button variant="outline" onClick={onExit}>
            <X size={16} /> Exit
          </Button>
        </div>
      )}

      <div className="flex items-center gap-2 text-xs text-muted">
        <ArrowRight size={14} />
        <span>Session recorded locally until you commit the outcome.</span>
      </div>
    </div>
  );
}
