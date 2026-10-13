/**
 * Context signals: what the engine is allowed to read.
 *
 * Privacy rules (spec §7):
 * - location only when settings.location_enabled is true
 * - coordinates are compared against known_places and never stored
 * - only the resulting context name is persisted (in Zustand cache)
 */

export interface TimeSignal {
  now: Date;
  timezone: string;
}

export interface EventSignal {
  id: string;
  title: string;
  start_at: string;
  end_at: string;
  location: string | null;
}

export interface TaskSignal {
  id: string;
  status: string;
  due_at: string | null;
}

export interface PlaceSignal {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius_m: number;
  context_hint: string | null;
}

export interface GeolocationSignal {
  latitude: number;
  longitude: number;
}

export interface MusicSignal {
  track: string | null;
  artist: string | null;
  mood: string;
}

export interface ContextSignals {
  time: TimeSignal;
  events: EventSignal[];
  tasks: TaskSignal[];
  places: PlaceSignal[];
  geolocation?: GeolocationSignal | null;
  music?: MusicSignal | null;
}

/** Haversine distance in meters. */
export function distanceMeters(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Nearest known place within its radius, or null. */
export function matchPlace(
  places: PlaceSignal[],
  geo: GeolocationSignal | null | undefined,
): PlaceSignal | null {
  if (!geo || places.length === 0) return null;
  for (const p of places) {
    const d = distanceMeters(
      { lat: geo.latitude, lon: geo.longitude },
      { lat: p.latitude, lon: p.longitude },
    );
    if (d <= p.radius_m) return p;
  }
  return null;
}
