'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useRouter } from 'next/navigation';
import { toggleTask } from '@/lib/actions/tasks';
import { formatDate, formatTime, isOngoing, relativeLabel } from '@/lib/utils/dates';
import { formatDuration } from '@/lib/utils/format';
import {
  LivingHero,
  LivingDayStory,
  LivingTimeline,
  LivingMissionMode,
  LivingCompletionAnimation,
  type LivingTimelineEntry,
  type LivingQuestView,
  type MissionSessionView,
} from '@/components/living';
import { LivingSection } from '@/components/living/LivingSection';

const stagger = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};
const item = {
  hidden: { opacity: 0, y: 10 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring' as const, stiffness: 100, damping: 20 },
  },
};

export interface LivingUserData {
  id: string;
  displayName: string | null;
  timezone: string;
}

export interface LivingPageProps {
  user: LivingUserData;
  now: string;
  tasks: ProjectedTask[];
  events: ProjectedEvent[];
  projects: ProjectedProject[];
  karateLast: { date: string; duration_min: number; focus: string } | null;
  entertainmentMinutesToday: number;
}

interface ProjectedTask {
  id: string;
  title: string;
  status: string;
  priority: string;
  due_at: string | null;
  project_id: string | null;
  description: string | null;
}

interface ProjectedEvent {
  id: string;
  title: string;
  start_at: string;
  end_at: string;
  location: string | null;
}

interface ProjectedProject {
  id: string;
  title: string;
  status: string;
}

function greetingFor(hour: number): string {
  if (hour < 12) return 'Ready to make today matter?';
  if (hour < 17) return 'Still time to move the day forward.';
  if (hour < 21) return 'Wind down with intention.';
  return 'Rest is part of the work too.';
}

function toMissionSession(q: LivingQuestView | null): MissionSessionView | null {
  if (!q) return null;
  return {
    id: q.id,
    title: q.title,
    subtitle: q.subtitle,
    objective: q.outcome ?? q.subtitle ?? 'Complete the mission and record the outcome.',
    notes: q.subtitle ?? null,
    estMinutes: q.estMinutes,
    campaignTitle: q.campaignTitle,
    outcome: q.outcome,
    accent: q.accent,
  };
}

function questFromTask(
  task: ProjectedTask,
  projects: ProjectedProject[],
): LivingQuestView {
  const project = projects.find((p) => p.id === task.project_id);
  const isMain = !!project && project.status === 'active';
  return {
    id: task.id,
    title: task.title,
    subtitle: task.description ?? null,
    outcome: null,
    estMinutes: null,
    priority: isMain ? 'main' : 'side',
    campaignId: project?.id ?? null,
    campaignTitle: project?.title ?? null,
    progressPct: 0,
    accent: isMain ? 'amethyst' : 'cyan',
    dueLabel: task.due_at ? relativeLabel(task.due_at) : null,
  };
}

function eventEntry(entry: ProjectedEvent): LivingTimelineEntry {
  const ongoing = isOngoing(entry.start_at, entry.end_at);
  return {
    id: entry.id,
    kind: 'fixed',
    title: entry.title,
    timeLabel: formatTime(entry.start_at) + ' – ' + formatTime(entry.end_at),
    duration: formatDuration(
      Math.max(0, new Date(entry.end_at).getTime() - new Date(entry.start_at).getTime()) / 60000,
    ),
    location: entry.location,
    completed: ongoing,
    accent: ongoing ? 'gold' : 'amethyst',
  };
}

export function LivingPage({
  user,
  now,
  tasks,
  events,
  projects,
  karateLast,
  entertainmentMinutesToday,
}: LivingPageProps) {
  const router = useRouter();
  const nowDate = new Date(now);
  const tz = user.timezone;

  const [selectedQuestId, setSelectedQuestId] = React.useState<string | null>(null);
  const [missionOpen, setMissionOpen] = React.useState(false);
  const [mission, setMission] = React.useState<MissionSessionView | null>(null);
  const [elapsedMs, setElapsedMs] = React.useState(0);
  const [running, setRunning] = React.useState(false);
  const [completed, setCompleted] = React.useState(false);
  const [completionVisible, setCompletionVisible] = React.useState(false);

  const quests = tasks.map((task) => questFromTask(task, projects));
  const mainQuest = quests.find((q) => q.priority === 'main') ?? null;
  const supporting = quests.filter((q) => q.priority !== 'main');
  void selectedQuestId;

  const theme = mainQuest?.campaignTitle ?? karateLast ? 'Train' : 'Advance';
  const themeAccent: 'amethyst' | 'gold' | 'cyan' | 'rose' =
    mainQuest ? 'amethyst' : karateLast ? 'gold' : 'cyan';

  const hero = {
    date: formatDate(nowDate, tz),
    greeting: greetingFor(nowDate.getHours()),
    summary:
      tasks.length > 0 || events.length > 0
        ? `You have ${tasks.length} active task${tasks.length === 1 ? '' : 's'} and ${events.length} scheduled block${events.length === 1 ? '' : 's'} today. ${mainQuest ? `Your main mission is ${mainQuest.title.toLowerCase()}.` : 'Pick a supporting quest and start moving.'}`
        : null,
  };

  const timeline: LivingTimelineEntry[] = [
    ...(events.length > 0 ? events.map(eventEntry) : []),
    {
      id: 'flex',
      kind: 'planned',
      title: 'Flexible time',
      timeLabel: 'Open windows today',
      duration: null,
      location: null,
      note: 'Use this for the main mission or recovery.',
      accent: 'amethyst',
    },
    {
      id: 'recovery',
      kind: 'suggested',
      title: 'Recovery time',
      timeLabel: 'Protect it on purpose',
      duration: null,
      location: null,
      note: 'Rest counts as progress.',
      accent: 'cyan',
    },
  ];

  function startMission(id: string) {
    const target = quests.find((q) => q.id === id);
    if (!target) return;
    setSelectedQuestId(id);
    setMission(toMissionSession(target));
    setElapsedMs(0);
    setRunning(true);
    setCompleted(false);
    setMissionOpen(true);
    setCompletionVisible(false);
  }

  async function handleComplete(outcome: string) {
    if (!mission) return;
    setRunning(false);
    setCompleted(true);
    setCompletionVisible(true);

    await new Promise((r) => setTimeout(r, 600));

    await toggleTask(mission.id, true);
    router.refresh();
    void outcome;
  }

  function exitMission() {
    setMissionOpen(false);
    setRunning(false);
    setCompleted(false);
    setCompletionVisible(false);
    setMission(null);
    setSelectedQuestId(null);
  }

  return (
    <motion.div
      variants={stagger}
      initial="hidden"
      animate="show"
      className="mx-auto flex min-h-[100dvh] flex-col max-w-[480px] px-4 pb-24 pt-5"
    >
      <motion.div variants={item}>
        <LivingHero
          date={hero.date}
          greeting={hero.greeting}
          summary={hero.summary}
          tone={themeAccent}
        />
      </motion.div>

      <motion.div variants={item}>
        <LivingDayStory
          theme={theme.toUpperCase()}
          themeAccent={themeAccent}          centralMission={toMissionSession(mainQuest)}
          supportingQuests={supporting}
          onSelectQuest={setSelectedQuestId}
          onStartMission={startMission}
        />
      </motion.div>

      <motion.div variants={item} className="grid gap-4">
        <LivingSection>
          <p className="text-[11px] uppercase tracking-widest text-white/50 mb-3">
            Your timeline today
          </p>
          <LivingTimeline entries={timeline} />
        </LivingSection>

        <LivingSection>
          <div className="flex items-center justify-between">
            <p className="text-[11px] uppercase tracking-widest text-white/50">
              Progress pulse
            </p>
            <div className="flex items-center gap-3 text-xs text-white/60">
              {karateLast ? (
                <span className="tabular-nums">
                  {karateLast.duration_min}m trained
                </span>
              ) : null}
              {entertainmentMinutesToday > 0 ? (
                <span className="tabular-nums">
                  {formatDuration(entertainmentMinutesToday)} logged
                </span>
              ) : null}
            </div>
          </div>
        </LivingSection>
      </motion.div>

      <AnimatePresence>
        {missionOpen && mission ? (
          <motion.div
            key="mission"
            variants={item}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ type: 'spring', stiffness: 100, damping: 20 }}
            className="mx-auto max-w-[480px]"
          >
            <LivingSection>
              <LivingMissionMode
                session={mission}
                elapsedMs={elapsedMs}
                running={running}
                completed={completed}
                onComplete={handleComplete}
                onExit={exitMission}
                onTimerToggle={(next) => {
                  setRunning(next.running);
                  setElapsedMs(next.elapsedMs);
                }}
              />
            </LivingSection>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <LivingCompletionAnimation
        visible={completionVisible}
        tone="gold"
      />
    </motion.div>
  );
}
