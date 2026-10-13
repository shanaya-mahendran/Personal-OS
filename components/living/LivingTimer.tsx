'use client';

import * as React from 'react';
import { Play, Pause, ArrowCounterClockwise } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { formatDuration } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';

export function LivingTimer({
  totalSeconds = 0,
  running,
  onChange,
  accent = 'amethyst',
  className,
}: {
  totalSeconds?: number;
  running?: boolean;
  onChange?: (next: { running: boolean; elapsedMs: number }) => void;
  accent?: 'amethyst' | 'gold' | 'cyan' | 'rose';
  className?: string;
}) {
  const accentColors: Record<string, string> = {
    amethyst: 'bg-[#9678ff] text-white dark:text-black',
    gold: 'bg-[#ffd36e] text-black',
    cyan: 'bg-[#5fe6d6] text-black',
    rose: 'bg-[#ff7c92] text-white',
  };

  const [elapsed, setElapsed] = React.useState(0);

  React.useEffect(() => {
    setElapsed(totalSeconds);
  }, [totalSeconds]);

  React.useEffect(() => {
    if (!onChange) return;
    onChange({ running: !!running, elapsedMs: elapsed * 1000 });
  }, [running, elapsed, onChange]);

  React.useEffect(() => {
    let id: ReturnType<typeof setInterval> | null = null;
    if (running) {
      id = setInterval(() => {
        setElapsed((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (id) clearInterval(id);
    };
  }, [running]);

  const reset = () => setElapsed(0);

  return (
    <div className={cn('flex flex-col items-center gap-3', className)}>
      <div
        className={cn(
          'relative flex h-24 w-24 items-center justify-center rounded-full font-mono text-3xl tabular tabular-nums',
          accentColors[accent] ?? accentColors.amethyst,
          'living-glow-line',
        )}
      >
        <span className="tabular-nums">{formatDuration(elapsed)}</span>
      </div>

      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => onChange?.({ running: !running, elapsedMs: elapsed * 1000 })}
        >
          {running ? <Pause size={18} weight="fill" /> : <Play size={18} weight="fill" />}
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={reset}
          aria-label="Reset timer"
        >
          <ArrowCounterClockwise size={18} />
        </Button>
      </div>
    </div>
  );
}
