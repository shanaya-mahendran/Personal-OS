'use client';

import * as React from 'react';
import { Sparkle } from '@phosphor-icons/react';
import { LivingAccentBar } from '@/components/living/LivingAccentBar';
import { LivingMissionCard, type LivingQuestView } from '@/components/living/LivingMissionCard';
import type { MissionSessionView } from '@/components/living/LivingMissionMode';
import { cn } from '@/lib/utils/cn';

type CentralMission = LivingQuestView | MissionSessionView;

function asQuest(central: CentralMission | null): LivingQuestView | null {
  if (!central) return null;
  if ('priority' in central) return central as LivingQuestView;
  return toCentralQuest(central as MissionSessionView);
}

function toCentralQuest(s: MissionSessionView): LivingQuestView {
  return {
    id: s.id,
    title: s.title,
    subtitle: s.subtitle,
    outcome: s.outcome,
    estMinutes: s.estMinutes,
    priority: 'main',
    campaignId: s.campaignTitle ? 'campaign' : null,
    campaignTitle: s.campaignTitle,
    progressPct: 0,
    accent: s.accent,
    dueLabel: null,
  };
}

interface LivingDayStoryProps {
  theme: string | null;
  themeAccent?: 'amethyst' | 'gold' | 'cyan' | 'rose';
  centralMission: CentralMission | null;
  supportingQuests: LivingQuestView[];
  onSelectQuest: (id: string) => void;
  onStartMission: (id: string) => void;
  className?: string;
}

export function LivingDayStory({
  theme,
  themeAccent = 'amethyst',
  centralMission,
  supportingQuests,
  onSelectQuest,
  onStartMission,
  className,
}: LivingDayStoryProps) {
  const [selected, setSelected] = React.useState<string | null>(
    centralMission?.id ?? supportingQuests[0]?.id ?? null,
  );

  const defaultSelected =
    centralMission?.id ?? supportingQuests[0]?.id ?? null;

  React.useEffect(() => {
    setSelected(defaultSelected);
  }, [defaultSelected]);

  const normalizedCentral = asQuest(centralMission);

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {theme ? (
        <div className="flex items-center gap-2">
          <Sparkle size={16} weight="duotone" className="text-[#9678ff]" />
          <span className="text-[11px] uppercase tracking-widest text-muted">{theme}</span>
          <LivingAccentBar tone={themeAccent} className="ml-auto" />
        </div>
      ) : null}

      <div className="grid gap-3">
        <p className="text-[11px] uppercase tracking-widest text-muted">Primary mission</p>

        {normalizedCentral ? (
          <LivingMissionCard
            quest={normalizedCentral}
            selected={selected === normalizedCentral.id}
            onSelect={() => onSelectQuest(normalizedCentral.id)}
            onStart={() => onStartMission(normalizedCentral.id)}
          />
        ) : (
          <div className="living-glass p-4 text-center">
            <p className="text-sm text-muted">
              Nothing flagged as the main mission today. Pick a supporting quest below.
            </p>
          </div>
        )}
      </div>

      {supportingQuests.length > 0 && (
        <div className="grid gap-2">
          <p className="text-[11px] uppercase tracking-widest text-muted">Supporting quests</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {supportingQuests.map((quest) => (
              <LivingMissionCard
                key={quest.id}
                quest={quest}
                selected={selected === quest.id}
                onSelect={() => onSelectQuest(quest.id)}
                onStart={() => onStartMission(quest.id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
