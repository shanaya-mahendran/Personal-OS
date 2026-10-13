'use client';

/**
 * Eating: daily meal checklist + water counter (spec §13).
 * No calorie math — the UI shows only what was actually logged.
 */
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Check, Minus, Plus } from '@phosphor-icons/react';
import type { MealRow, WaterLogRow, MealType } from '@/lib/supabase/types';
import { toggleMeal, adjustWater } from '@/lib/actions/modules';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils/cn';

const MEALS: { type: MealType; label: string }[] = [
  { type: 'breakfast', label: 'Breakfast' },
  { type: 'lunch', label: 'Lunch' },
  { type: 'dinner', label: 'Dinner' },
  { type: 'snack', label: 'Snacks' },
];

const WATER_GOAL = 8;

export function EatingView({
  today,
  meals,
  water,
}: {
  today: string;
  meals: MealRow[];
  water: WaterLogRow[];
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<string | null>(null);

  const todaysMeals = meals.filter((m) => m.date === today);
  const waterRow = water.find((w) => w.date === today);
  const glasses = waterRow?.glasses ?? 0;

  const weekWater = water.reduce((sum, w) => sum + w.glasses, 0);

  async function toggle(type: MealType) {
    const current = todaysMeals.find((m) => m.meal_type === type);
    // Cycle: unlogged → eaten → skipped → eaten …
    const skipped = current ? !current.skipped : false;
    setBusy(type);
    await toggleMeal({ date: today, meal_type: type, skipped });
    setBusy(null);
    router.refresh();
  }

  async function waterChange(delta: number) {
    setBusy('water');
    await adjustWater({ date: today, delta });
    setBusy(null);
    router.refresh();
  }

  return (
    <div className="mx-auto grid max-w-[560px] gap-4">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Eating</h1>
        <p className="font-mono text-sm tabular text-muted">{today}</p>
      </header>

      <Card>
        <CardContent>
          <CardTitle>Today&apos;s meals</CardTitle>
          <ul className="hairline-divide mt-2">
            {MEALS.map((m) => {
              const record = todaysMeals.find((x) => x.meal_type === m.type);
              const skipped = record?.skipped ?? false;
              const logged = Boolean(record);
              return (
                <li key={m.type} className="flex min-h-[44px] items-center justify-between gap-3 py-2">
                  <span className={cn('text-sm', skipped ? 'text-muted line-through' : 'text-ink')}>
                    {m.label}
                  </span>
                  <div className="flex items-center gap-2">
                    {record?.description ? (
                      <span className="max-w-[140px] truncate text-xs text-muted">
                        {record.description}
                      </span>
                    ) : null}
                    <button
                      type="button"
                      disabled={busy === m.type}
                      aria-label={`Toggle ${m.label}`}
                      onClick={() => void toggle(m.type)}
                      className={cn(
                        'flex h-7 w-7 items-center justify-center rounded-full border transition-colors',
                        skipped
                          ? 'border-warning bg-warning/10 text-warning'
                          : logged
                            ? 'border-grove bg-grove text-white'
                            : 'border-line bg-surface text-muted',
                      )}
                    >
                      {logged && !skipped ? <Check size={13} weight="bold" /> : <Minus size={13} />}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Water</CardTitle>
              <p className="font-mono text-xs tabular text-muted">
                {weekWater} glasses in the last 7 days
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                aria-label="Remove a glass"
                disabled={busy === 'water' || glasses === 0}
                onClick={() => void waterChange(-1)}
              >
                <Minus size={14} />
              </Button>
              <span className="w-14 text-center font-mono text-lg tabular text-ink">
                {glasses}/{WATER_GOAL}
              </span>
              <Button
                size="sm"
                variant="outline"
                aria-label="Add a glass"
                disabled={busy === 'water'}
                onClick={() => void waterChange(1)}
              >
                <Plus size={14} />
              </Button>
            </div>
          </div>
          <div className="mt-3 flex gap-1.5" aria-hidden="true">
            {Array.from({ length: WATER_GOAL }, (_, i) => (
              <span
                key={i}
                className={cn(
                  'h-6 flex-1 rounded-md border',
                  i < glasses ? 'border-grove bg-grove-tint' : 'border-line bg-surface',
                )}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      <section className="rounded-2xl border border-line bg-surface p-4">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">This week</p>
        <ul className="hairline-divide">
          {meals.slice(0, 14).map((m) => (
            <li key={m.id} className="flex items-center justify-between py-2 text-sm">
              <span className="font-mono text-xs tabular text-muted">{m.date}</span>
              <span className="capitalize text-ink">{m.meal_type}</span>
              <span className={cn('text-xs', m.skipped ? 'text-warning' : 'text-grove')}>
                {m.skipped ? 'skipped' : 'eaten'}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
