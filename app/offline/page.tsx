'use client';

import Link from 'next/link';
import { WifiSlash } from '@phosphor-icons/react';

/** Offline fallback cached by the service worker. */
export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-[480px] flex-col items-center justify-center gap-4 px-6 text-center">
      <WifiSlash size={32} className="text-muted" weight="duotone" />
      <h1 className="text-xl font-semibold tracking-tight">You are offline</h1>
      <p className="max-w-[40ch] text-sm text-muted">
        Today&apos;s tasks, events, and prayer times are cached on this device. Captures you
        write now are queued and will sync when the connection returns.
      </p>
      <Link
        href="/dashboard"
        className="rounded-full bg-grove px-5 py-2.5 text-sm font-medium text-white"
      >
        Try again
      </Link>
    </main>
  );
}
