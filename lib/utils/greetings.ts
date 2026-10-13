import type { ContextState } from '@/lib/context/states';

export interface DynamicGreetingOptions {
  date?: Date;
  timezone?: string;
  context?: ContextState | null;
  hasActiveTask?: boolean;
  displayName?: string | null;
}

/**
 * Computes a dynamic, context-aware greeting.
 * Eliminates awkward static greetings (such as "Good morning" at 1 AM).
 */
export function getDynamicGreeting(options: DynamicGreetingOptions = {}): string {
  const now = options.date ?? new Date();
  let hour = now.getHours();

  if (options.timezone) {
    try {
      const parts = new Intl.DateTimeFormat('en-GB', {
        hour: 'numeric',
        hour12: false,
        timeZone: options.timezone,
      }).formatToParts(now);
      const h = Number(parts.find((p) => p.type === 'hour')?.value);
      if (!Number.isNaN(h)) hour = h;
    } catch {
      // Fallback to local hour
    }
  }

  // Activity & context specific overrides
  const isWorking =
    options.hasActiveTask ||
    options.context === 'STUDYING' ||
    options.context === 'WORKSHOP' ||
    options.context === 'UNIVERSITY';

  if (isWorking) {
    if (hour >= 23 || hour < 5) return 'Working late';
    if (hour < 12) return 'Morning focus';
    if (hour < 17) return 'Afternoon session';
    return 'Evening focus';
  }

  if (options.context === 'KARATE') {
    return 'Dojo mode';
  }

  if (options.context === 'FAMILY_TIME') {
    return 'Family time';
  }

  if (options.context === 'ENTERTAINMENT') {
    return 'Unwinding';
  }

  // Time-of-day natural greetings
  if (hour >= 0 && hour < 5) {
    return 'Late night';
  }
  if (hour >= 5 && hour < 12) {
    return 'Good morning';
  }
  if (hour >= 12 && hour < 17) {
    return 'Good afternoon';
  }
  if (hour >= 17 && hour < 22) {
    return 'Good evening';
  }
  return 'Wind down';
}
