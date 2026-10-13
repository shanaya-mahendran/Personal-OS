'use client';

/**
 * React hook: flush the IndexedDB capture queue whenever the browser comes
 * back online (and once on mount).
 */
import * as React from 'react';
import { submitCapture } from '@/lib/actions/capture';
import { flushQueue, isOffline, listQueuedCaptures } from './queue';

export function useCaptureSync(): { queuedCount: number; syncing: boolean } {
  const [queuedCount, setQueuedCount] = React.useState(0);
  const [syncing, setSyncing] = React.useState(false);

  const refresh = React.useCallback(async () => {
    const queued = await listQueuedCaptures();
    setQueuedCount(queued.length);
  }, []);

  const flush = React.useCallback(async () => {
    if (isOffline()) return;
    setSyncing(true);
    const { flushed, remaining } = await flushQueue(async (rawText) => {
      const res = await submitCapture({ raw_text: rawText, input_type: 'text' });
      return { ok: res.ok };
    });
    setSyncing(false);
    setQueuedCount(remaining);
    if (flushed > 0 && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('shanaya:capture-flushed', { detail: { flushed } }));
    }
  }, []);

  React.useEffect(() => {
    void refresh();
    const onOnline = () => void flush();
    window.addEventListener('online', onOnline);
    navigator.serviceWorker?.addEventListener?.('message', (event) => {
      if (event.data?.type === 'flush-capture-queue') void flush();
    });
    return () => window.removeEventListener('online', onOnline);
  }, [flush, refresh]);

  return { queuedCount, syncing };
}
