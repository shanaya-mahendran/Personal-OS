'use client';

/**
 * Settings view: privacy-first. Location is off by default; coordinates are
 * only ever compared against known_places (never stored); the theme toggle
 * applies immediately.
 */
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash } from '@phosphor-icons/react';
import type { ProfileRow, SettingsRow, KnownPlaceRow } from '@/lib/supabase/types';
import { addKnownPlace, removeKnownPlace, updateProfile, updateSettings } from '@/lib/actions/settings';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/field';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export interface SettingsData {
  email: string;
  profile: ProfileRow | null;
  settings: SettingsRow | null;
  places: KnownPlaceRow[];
}

const TIMEZONES = [
  'Asia/Colombo',
  'Asia/Kolkata',
  'Asia/Dubai',
  'Asia/Singapore',
  'Europe/London',
  'America/New_York',
  'America/Los_Angeles',
  'Australia/Sydney',
];

export function SettingsView({ data }: { data: SettingsData }) {
  const router = useRouter();
  const [name, setName] = React.useState(data.profile?.display_name ?? '');
  const [timezone, setTimezone] = React.useState(data.profile?.timezone ?? 'Asia/Colombo');
  const [contextEngine, setContextEngine] = React.useState(
    data.settings?.context_engine_enabled ?? true,
  );
  const [location, setLocation] = React.useState(data.settings?.location_enabled ?? false);
  const [theme, setTheme] = React.useState(data.settings?.theme ?? 'system');
  const [leadMinutes, setLeadMinutes] = React.useState(() => {
    const prefs = data.settings?.notification_prefs as { lead_minutes?: number } | null;
    return String(prefs?.lead_minutes ?? 15);
  });
  const [message, setMessage] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const [place, setPlace] = React.useState({
    name: '',
    latitude: '',
    longitude: '',
    radius_m: '150',
    context_hint: '',
  });
  const [placeError, setPlaceError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') root.classList.add('dark');
    else if (theme === 'light') root.classList.remove('dark');
    else {
      root.classList.toggle('dark', window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
  }, [theme]);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await updateProfile({ display_name: name, timezone });
    setBusy(false);
    setMessage(res.ok ? 'Saved' : (res.error ?? 'Could not save'));
    router.refresh();
  }

  async function changeSetting(patch: {
    context_engine_enabled?: boolean;
    location_enabled?: boolean;
    theme?: 'light' | 'dark' | 'system';
    notification_prefs?: Record<string, unknown>;
  }) {
    const res = await updateSettings(patch);
    setMessage(res.ok ? 'Saved' : (res.error ?? 'Could not save'));
    router.refresh();
  }

  async function addPlace(e: React.FormEvent) {
    e.preventDefault();
    setPlaceError(null);
    const res = await addKnownPlace({
      name: place.name.trim(),
      latitude: place.latitude,
      longitude: place.longitude,
      radius_m: place.radius_m,
      context_hint: place.context_hint.trim() || place.name.trim(),
    });
    if (!res.ok) {
      setPlaceError(res.error ?? 'Could not save place');
      return;
    }
    setPlace({ name: '', latitude: '', longitude: '', radius_m: '150', context_hint: '' });
    router.refresh();
  }

  return (
    <div className="mx-auto grid max-w-[560px] gap-5">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted">{data.email}</p>
      </header>

      {message ? <p className="text-sm text-grove">{message}</p> : null}

      <form onSubmit={(e) => void saveProfile(e)} className="grid gap-3">
        <Field label="Display name" htmlFor="s-name" required>
          <Input id="s-name" value={name} onChange={(e) => setName(e.target.value)} required />
        </Field>
        <Field label="Timezone" htmlFor="s-tz" helper="Every timestamp renders in this timezone.">
          <Select value={timezone} onValueChange={setTimezone}>
            <SelectTrigger id="s-tz">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIMEZONES.map((tz) => (
                <SelectItem key={tz} value={tz}>
                  {tz}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Button type="submit" size="sm" disabled={busy} className="justify-self-start">
          {busy ? 'Saving…' : 'Save profile'}
        </Button>
      </form>

      <section className="rounded-2xl border border-line bg-surface p-4">
        <p className="mb-3 text-sm font-semibold">Appearance</p>
        <Field label="Theme" htmlFor="s-theme">
          <Select
            value={theme}
            onValueChange={(v) => {
              const next = v as 'light' | 'dark' | 'system';
              setTheme(next);
              void changeSetting({ theme: next });
            }}
          >
            <SelectTrigger id="s-theme">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="system">System</SelectItem>
              <SelectItem value="light">Light</SelectItem>
              <SelectItem value="dark">Dark</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </section>

      <section className="rounded-2xl border border-line bg-surface p-4">
        <p className="mb-3 text-sm font-semibold">Context engine</p>
        <label className="flex items-center justify-between gap-3 py-2 text-sm">
          <span>
            Enable context detection
            <span className="block text-xs text-muted">
              Uses time, your events, and optional location.
            </span>
          </span>
          <Switch
            checked={contextEngine}
            onCheckedChange={(v) => {
              setContextEngine(v);
              void changeSetting({ context_engine_enabled: v });
            }}
          />
        </label>
        <label className="flex items-center justify-between gap-3 border-t border-line py-2 text-sm">
          <span>
            Use my location
            <span className="block text-xs text-muted">
              Off by default. Coordinates are compared against your known places in memory and
              never stored; only the context name is kept.
            </span>
          </span>
          <Switch
            checked={location}
            onCheckedChange={(v) => {
              setLocation(v);
              void changeSetting({ location_enabled: v });
            }}
          />
        </label>
      </section>

      <section className="rounded-2xl border border-line bg-surface p-4">
        <p className="mb-3 text-sm font-semibold">Notifications</p>
        <Field label="Remind me this many minutes before" htmlFor="s-lead">
          <Input
            id="s-lead"
            type="number"
            min={0}
            max={180}
            value={leadMinutes}
            onChange={(e) => setLeadMinutes(e.target.value)}
            onBlur={() =>
              void changeSetting({
                notification_prefs: {
                  ...(data.settings?.notification_prefs as object | null),
                  lead_minutes: Number(leadMinutes),
                  reminders: true,
                },
              })
            }
            className="max-w-[140px]"
          />
        </Field>
      </section>

      <section className="rounded-2xl border border-line bg-surface p-4">
        <p className="mb-1 text-sm font-semibold">Known places</p>
        <p className="mb-3 text-xs text-muted">
          Geofences the context engine matches against. Added manually, never imported.
        </p>

        {data.places.length > 0 ? (
          <ul className="hairline-divide mb-3">
            {data.places.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                <span className="min-w-0">
                  <span className="block truncate text-ink">{p.name}</span>
                  <span className="block font-mono text-[11px] tabular text-muted">
                    {p.radius_m}m · {p.context_hint ?? 'no hint'}
                  </span>
                </span>
                <button
                  type="button"
                  aria-label={`Remove ${p.name}`}
                  onClick={async () => {
                    await removeKnownPlace(p.id);
                    router.refresh();
                  }}
                  className="rounded-full p-2 text-muted hover:bg-danger/10 hover:text-danger"
                >
                  <Trash size={15} />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mb-3 text-sm text-muted">No places yet.</p>
        )}

        <form onSubmit={(e) => void addPlace(e)} className="grid gap-3">
          <Field label="Name" htmlFor="p-name" required>
            <Input
              id="p-name"
              value={place.name}
              onChange={(e) => setPlace({ ...place, name: e.target.value })}
              required
              placeholder="University of Moratuwa"
            />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Latitude" htmlFor="p-lat" required>
              <Input
                id="p-lat"
                value={place.latitude}
                onChange={(e) => setPlace({ ...place, latitude: e.target.value })}
                required
                inputMode="decimal"
                placeholder="6.9147"
              />
            </Field>
            <Field label="Longitude" htmlFor="p-lng" required>
              <Input
                id="p-lng"
                value={place.longitude}
                onChange={(e) => setPlace({ ...place, longitude: e.target.value })}
                required
                inputMode="decimal"
                placeholder="79.9620"
              />
            </Field>
            <Field label="Radius (m)" htmlFor="p-radius">
              <Input
                id="p-radius"
                type="number"
                min={10}
                max={5000}
                value={place.radius_m}
                onChange={(e) => setPlace({ ...place, radius_m: e.target.value })}
              />
            </Field>
          </div>
          <Field label="Context hint" htmlFor="p-hint" helper="e.g. UNIVERSITY, KARATE, HOME">
            <Input
              id="p-hint"
              value={place.context_hint}
              onChange={(e) => setPlace({ ...place, context_hint: e.target.value })}
            />
          </Field>
          {placeError ? <p className="text-sm text-danger">{placeError}</p> : null}
          <Button type="submit" size="sm" variant="outline" className="justify-self-start">
            <Plus size={14} /> Add place
          </Button>
        </form>
      </section>
    </div>
  );
}
