'use client';

/**
 * ContextProvider: aggregates signals, evaluates the context engine,
 * refreshes every 60 seconds, and exposes the result to the dashboard.
 *
 * Privacy: geolocation is read only when settings.location_enabled is true,
 * coordinates are compared against known_places in memory, and only the
 * resulting context name is cached.
 */
import * as React from 'react';
import { createClient } from '@/lib/supabase/client';
import { evaluateContext } from '@/lib/context/engine';
import type { ContextResult } from '@/lib/context/states';
import type { EventSignal, PlaceSignal, TaskSignal } from '@/lib/context/signals';
import { useContextStore } from '@/lib/stores/app-store';
import { browserTimeZone } from '@/lib/utils/dates';

const REFRESH_MS = 60_000;

interface ContextStateValue {
  result: ContextResult | null;
  loading: boolean;
  refresh: () => void;
}

const ContextReactContext = React.createContext<ContextStateValue>({
  result: null,
  loading: true,
  refresh: () => {},
});

export function ContextProvider({
  children,
  locationEnabled = false,
}: {
  children: React.ReactNode;
  locationEnabled?: boolean;
}) {
  const { result, setResult, setLocationEnabled } = useContextStore();
  const [loading, setLoading] = React.useState(true);

  const evaluate = React.useCallback(async () => {
    const timezone = browserTimeZone();
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const now = new Date();
    const dayStart = new Date(now);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const [eventsRes, tasksRes, placesRes, settingsRes] = await Promise.all([
      supabase
        .from('events')
        .select('id, title, start_at, end_at, location')
        .eq('user_id', user.id)
        .lt('start_at', dayEnd.toISOString())
        .gt('end_at', dayStart.toISOString())
        .neq('status', 'cancelled'),
      supabase
        .from('tasks')
        .select('id, status, due_at')
        .eq('user_id', user.id)
        .neq('status', 'cancelled')
        .limit(50),
      supabase
        .from('known_places')
        .select('id, name, latitude, longitude, radius_m, context_hint')
        .eq('user_id', user.id),
      supabase
        .from('settings')
        .select('context_engine_enabled, location_enabled')
        .eq('user_id', user.id)
        .maybeSingle(),
    ]);

    const settingsEnabled = settingsRes.data?.context_engine_enabled ?? true;
    const locationAllowed =
      locationEnabled && (settingsRes.data?.location_enabled ?? false);

    if (!settingsEnabled) {
      setResult({
        context: 'UNKNOWN',
        confidence: 0,
        location_match: false,
        time_match: false,
        source: 'none',
        label: 'Context engine off',
      });
      setLoading(false);
      return;
    }

    const events = (eventsRes.data ?? []) as EventSignal[];
    const tasks = (tasksRes.data ?? []) as TaskSignal[];
    const places = (placesRes.data ?? []) as PlaceSignal[];

    let geo: GeolocationPosition | null = null;
    if (locationAllowed && typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      geo = await new Promise<GeolocationPosition | null>((resolve) => {
        const timer = setTimeout(() => resolve(null), 4000);
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            clearTimeout(timer);
            resolve(pos);
          },
          () => {
            clearTimeout(timer);
            resolve(null);
          },
          { timeout: 4000, maximumAge: 300_000 },
        );
      });
    }

    const next = evaluateContext({
      time: { now, timezone },
      events,
      tasks,
      places,
      geolocation: geo
        ? { latitude: geo.coords.latitude, longitude: geo.coords.longitude }
        : null,
      music: null,
    });

    setResult(next);
    setLoading(false);
  }, [locationEnabled, setResult]);

  React.useEffect(() => {
    setLocationEnabled(locationEnabled);
    void evaluate();
    const id = setInterval(() => void evaluate(), REFRESH_MS);
    return () => clearInterval(id);
  }, [evaluate, locationEnabled, setLocationEnabled]);

  const value = React.useMemo(
    () => ({ result, loading, refresh: () => void evaluate() }),
    [result, loading, evaluate],
  );

  return <ContextReactContext.Provider value={value}>{children}</ContextReactContext.Provider>;
}

export function useContextEngine(): ContextStateValue {
  return React.useContext(ContextReactContext);
}
