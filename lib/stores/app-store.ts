/**
 * Context cache (Zustand). Recomputed every 60 seconds by ContextProvider.
 * Only the derived context name is cached — never raw coordinates.
 */
import { create } from 'zustand';
import type { ContextResult } from '@/lib/context/states';

interface ContextStore {
  result: ContextResult | null;
  updatedAt: number | null;
  locationEnabled: boolean;
  setResult: (r: ContextResult) => void;
  setLocationEnabled: (v: boolean) => void;
  clear: () => void;
}

export const useContextStore = create<ContextStore>((set) => ({
  result: null,
  updatedAt: null,
  locationEnabled: false,
  setResult: (result) => set({ result, updatedAt: Date.now() }),
  setLocationEnabled: (locationEnabled) => set({ locationEnabled }),
  clear: () => set({ result: null, updatedAt: null }),
}));

interface CaptureStore {
  /** Capture ids currently processing (optimistic "Processing…" skeletons). */
  pending: string[];
  /** Capture id whose preview sheet is open. */
  activeCaptureId: string | null;
  addPending: (id: string) => void;
  resolvePending: (id: string) => void;
  openPreview: (id: string | null) => void;
}

export const useCaptureStore = create<CaptureStore>((set) => ({
  pending: [],
  activeCaptureId: null,
  addPending: (id) =>
    set((s) => ({ pending: s.pending.includes(id) ? s.pending : [...s.pending, id] })),
  resolvePending: (id) => set((s) => ({ pending: s.pending.filter((p) => p !== id) })),
  openPreview: (activeCaptureId) => set({ activeCaptureId }),
}));
