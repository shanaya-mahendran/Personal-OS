import { describe, expect, it } from 'vitest';
import { findOverlaps, intervalsOverlap } from '@/lib/calendar/conflicts';

const a = { id: 'a', start_at: '2026-05-01T10:00:00Z', end_at: '2026-05-01T11:00:00Z' };
const b = { id: 'b', start_at: '2026-05-01T11:00:00Z', end_at: '2026-05-01T12:00:00Z' };
const c = { id: 'c', start_at: '2026-05-01T10:30:00Z', end_at: '2026-05-01T11:30:00Z' };

describe('intervalsOverlap', () => {
  const span = (e: { id: string; start_at: string; end_at: string }) => ({
    start: e.start_at,
    end: e.end_at,
  });

  it('detects partial overlap', () => {
    expect(intervalsOverlap(span(a), span(c))).toBe(true);
  });

  it('treats back-to-back as no conflict', () => {
    expect(intervalsOverlap(span(a), span(b))).toBe(false);
  });

  it('is symmetric', () => {
    expect(intervalsOverlap(span(c), span(a))).toBe(intervalsOverlap(span(a), span(c)));
  });

  it('catches full containment', () => {
    const big = { start: '2026-05-01T09:00:00Z', end: '2026-05-01T13:00:00Z' };
    expect(intervalsOverlap(big, span(a))).toBe(true);
  });
});

describe('findOverlaps', () => {
  it('returns only overlapping events', () => {
    const result = findOverlaps([a, b], {
      start_at: '2026-05-01T10:45:00Z',
      end_at: '2026-05-01T12:30:00Z',
    });
    expect(result.map((e) => e.id)).toEqual(['a', 'b']);
  });

  it('excludes the event being edited', () => {
    const result = findOverlaps(
      [a, c],
      { start_at: '2026-05-01T10:00:00Z', end_at: '2026-05-01T12:00:00Z' },
      'a',
    );
    expect(result.map((e) => e.id)).toEqual(['c']);
  });

  it('returns empty for a free slot', () => {
    const result = findOverlaps([a], {
      start_at: '2026-05-01T13:00:00Z',
      end_at: '2026-05-01T14:00:00Z',
    });
    expect(result).toEqual([]);
  });
});
