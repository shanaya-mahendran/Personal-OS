'use client';

/**
 * QuickCapture: the persistent bottom input ("What's on your mind?").
 * Submitting creates a capture row and routes to /inbox for the proposal.
 */
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { PaperPlaneTilt } from '@phosphor-icons/react';
import { submitCapture } from '@/lib/actions/capture';
import { useCaptureStore } from '@/lib/stores/app-store';
import { enqueueCapture, isOffline } from '@/lib/offline/queue';
import { useCaptureSync } from '@/lib/offline/useCaptureSync';

export function QuickCapture() {
  const router = useRouter();
  const [text, setText] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [note, setNote] = React.useState<string | null>(null);
  const addPending = useCaptureStore((s) => s.addPending);
  const { queuedCount } = useCaptureSync();

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!text.trim()) return;
    setError(null);

    // Offline: queue locally; it syncs when the connection returns (§17).
    if (isOffline()) {
      await enqueueCapture(text.trim());
      setText('');
      setNote('Offline: capture queued, it will sync when you are back online.');
      return;
    }

    setBusy(true);
    const res = await submitCapture({ raw_text: text.trim(), input_type: 'text' });
    setBusy(false);
    if (!res.ok || !res.data) {
      setError(res.error ?? 'Could not save capture');
      return;
    }
    addPending(res.data.id);
    setText('');
    setNote(null);
    router.push('/inbox');
  }

  return (
    <form
      onSubmit={(e) => void submit(e)}
      className="bezel sticky bottom-20 z-20"
      aria-label="Quick capture"
    >
      <div className="bezel-core flex items-center gap-2 p-2 pl-4">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="What's on your mind?"
          aria-label="Quick capture"
          className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-muted"
        />
        <button
          type="submit"
          disabled={busy || !text.trim()}
          aria-label="Capture"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-grove text-white transition-transform active:scale-95 disabled:opacity-40 dark:text-black"
        >
          <PaperPlaneTilt size={16} weight="bold" />
        </button>
      </div>
      {error ? <p className="px-3 pb-2 text-xs text-danger">{error}</p> : null}
      {note ? <p className="px-3 pb-2 text-xs text-grove">{note}</p> : null}
      {queuedCount > 0 && !note ? (
        <p className="px-3 pb-2 text-xs text-muted">
          {queuedCount} capture{queuedCount === 1 ? '' : 's'} waiting to sync
        </p>
      ) : null}
    </form>
  );
}
