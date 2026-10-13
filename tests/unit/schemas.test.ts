import { describe, expect, it } from 'vitest';
import {
  CaptureResultSchema,
  ConfidenceSchema,
  isLowConfidence,
  LOW_CONFIDENCE,
} from '@/lib/gemini/schemas';
import { normalizeConfidence, overallConfidence, lowConfidenceFields } from '@/lib/ai/confidence';
import { TaskCreateSchema, EventCreateSchema, RRuleSchema } from '@/lib/validation/schema';

describe('CaptureResultSchema', () => {
  it('accepts a valid task', () => {
    const result = CaptureResultSchema.safeParse({
      type: 'task',
      title: 'Submit COS201 assignment',
      priority: 'high',
      due_at: '2026-05-02T23:59:00+05:30',
      area_hint: 'University',
      project_hint: null,
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.type).toBe('task');
  });

  it('accepts a valid event', () => {
    const result = CaptureResultSchema.safeParse({
      type: 'event',
      title: 'IEEE workshop',
      start_at: '2026-05-04T09:00:00+05:30',
      end_at: '2026-05-04T11:00:00+05:30',
      timezone: 'Asia/Colombo',
      location: 'New Building, University of Moratuwa',
      organizer: 'IEEE SB',
    });
    expect(result.success).toBe(true);
  });

  it('rejects an event without times', () => {
    const result = CaptureResultSchema.safeParse({ type: 'event', title: 'x' });
    expect(result.success).toBe(false);
  });

  it('rejects an unknown type', () => {
    const result = CaptureResultSchema.safeParse({ type: 'banana' });
    expect(result.success).toBe(false);
  });

  it('accepts career opportunities with opportunity_type', () => {
    const result = CaptureResultSchema.safeParse({
      type: 'career_opportunity',
      company: 'IFS',
      role: 'Software Engineer Intern',
      opportunity_type: 'internship',
      work_mode: 'hybrid',
      url: 'https://careers.ifs.com/jobs/1',
      deadline_at: null,
    });
    expect(result.success).toBe(true);
  });

  it('accepts unknown with a reason', () => {
    const result = CaptureResultSchema.safeParse({ type: 'unknown', reason: 'no clear action' });
    expect(result.success).toBe(true);
  });
});

describe('ConfidenceSchema', () => {
  it('clamps to [0,1]', () => {
    const parsed = ConfidenceSchema.parse({ date: 1.4, location: -0.2 });
    expect(parsed.date).toBe(1);
    expect(parsed.location).toBe(0);
  });

  it('flags low confidence fields', () => {
    expect(isLowConfidence(LOW_CONFIDENCE - 0.01)).toBe(true);
    expect(isLowConfidence(LOW_CONFIDENCE + 0.01)).toBe(false);
    expect(isLowConfidence(undefined)).toBe(false);
  });
});

describe('confidence helpers', () => {
  it('fills missing fields with the conservative default', () => {
    const conf = normalizeConfidence({ title: 0.9 }, ['title', 'location'], 0.5);
    expect(conf.title).toBe(0.9);
    expect(conf.location).toBe(0.5);
  });

  it('averages overall confidence', () => {
    expect(overallConfidence({ a: 1, b: 0.5 })).toBeCloseTo(0.75);
    expect(overallConfidence({})).toBe(0);
  });

  it('lists low fields', () => {
    expect(lowConfidenceFields({ a: 0.9, b: 0.7 })).toEqual(['b']);
  });
});

describe('TaskCreateSchema', () => {
  it('requires a title', () => {
    expect(TaskCreateSchema.safeParse({ title: '' }).success).toBe(false);
  });

  it('applies default priority', () => {
    const parsed = TaskCreateSchema.parse({ title: 'Buy milk' });
    expect(parsed.priority).toBe('medium');
  });

  it('normalizes empty due date to null', () => {
    const parsed = TaskCreateSchema.parse({ title: 'x', due_at: '' });
    expect(parsed.due_at).toBeNull();
  });
});

describe('EventCreateSchema', () => {
  it('rejects end before start', () => {
    const result = EventCreateSchema.safeParse({
      title: 'x',
      start_at: '2026-05-01T11:00:00+05:30',
      end_at: '2026-05-01T10:00:00+05:30',
    });
    expect(result.success).toBe(false);
  });

  it('accepts ordered times', () => {
    const result = EventCreateSchema.safeParse({
      title: 'x',
      start_at: '2026-05-01T10:00:00+05:30',
      end_at: '2026-05-01T11:00:00+05:30',
    });
    expect(result.success).toBe(true);
  });
});

describe('RRuleSchema', () => {
  it('accepts common RRULEs', () => {
    expect(RRuleSchema.safeParse('RRULE:FREQ=WEEKLY;BYDAY=MO').success).toBe(true);
    expect(RRuleSchema.safeParse('RRULE:FREQ=DAILY;INTERVAL=2;COUNT=10').success).toBe(true);
  });

  it('rejects unknown frequencies', () => {
    expect(RRuleSchema.safeParse('RRULE:FREQ=HOURLY').success).toBe(false);
    expect(RRuleSchema.safeParse('FREQ=DAILY').success).toBe(false);
  });
});
