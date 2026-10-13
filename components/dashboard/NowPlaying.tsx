'use client';

/**
 * NowPlaying: active music session (ended_at IS NULL) or an honest empty state.
 */
import { MusicNoteSimple } from '@phosphor-icons/react';
import { Card, CardContent, CardTitle } from '@/components/ui/card';
import { formatDuration } from '@/lib/utils/format';

export interface NowPlayingData {
  track: string | null;
  artist: string | null;
  mood: string;
  started_at: string;
}

export function NowPlaying({ session }: { session: NowPlayingData | null }) {
  if (!session) {
    return (
      <Card>
        <CardContent>
          <CardTitle>Now playing</CardTitle>
          <p className="mt-2 text-sm text-muted">Nothing playing right now.</p>
        </CardContent>
      </Card>
    );
  }

  const minutes = Math.max(
    0,
    Math.round((Date.now() - new Date(session.started_at).getTime()) / 60_000),
  );

  return (
    <Card>
      <CardContent>
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-grove-tint text-grove">
            <MusicNoteSimple size={18} weight="duotone" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-ink">
              {session.track ?? 'Unknown track'}
            </p>
            <p className="truncate text-xs text-muted">{session.artist ?? 'Unknown artist'}</p>
          </div>
          <div className="text-right">
            <p className="font-mono text-xs tabular text-ink">{formatDuration(minutes)}</p>
            <p className="text-[10px] uppercase tracking-wide text-muted">{session.mood}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
