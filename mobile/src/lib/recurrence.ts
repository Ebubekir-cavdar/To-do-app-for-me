import { addDays, dayIndex, parseYmd, ymd } from './dates';
import { normalizeTime } from './tasks';
import type { NewTask } from '../model/task';

/** How long a "Ferman" (recurring add) runs, starting on its start day. */
export type Span = { unit: 'week' | 'month'; count: number };

export const SPANS: { label: string; span: Span }[] = [
  { label: '1 Hafta', span: { unit: 'week', count: 1 } },
  { label: '2 Hafta', span: { unit: 'week', count: 2 } },
  { label: '1 Ay', span: { unit: 'month', count: 1 } },
  { label: '3 Ay', span: { unit: 'month', count: 3 } },
];
export const DEFAULT_SPAN_INDEX = 2; // 1 Ay

/** Upper bound on tasks one Ferman may create (3 months every day = 92). */
export const MAX_OCCURRENCES = 200;

/** All weekdays, 0 = Monday … 6 = Sunday (same indexing as dayIndex). */
export const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6] as const;

/**
 * Last day (inclusive) of a span starting at `start`.
 * 1 week from Mon 20 Oct → Sun 26 Oct. 1 month from 17 Oct → 16 Nov.
 * If the target month is too short for the start day, the span ends on that month's
 * last day: 1 month from 31 Jan → 28 Feb (29 in leap years).
 */
export function spanEnd(start: Date, span: Span): Date {
  if (span.unit === 'week') return addDays(start, 7 * span.count - 1);
  const y = start.getFullYear();
  const m = start.getMonth() + span.count;
  const lastDayOfTarget = new Date(y, m + 1, 0).getDate();
  const sameDay = new Date(y, m, Math.min(start.getDate(), lastDayOfTarget));
  // If the start day was clamped (31 Jan → 28 Feb), the span ends on that clamped day;
  // otherwise it ends the day before the same date next month.
  return start.getDate() > lastDayOfTarget ? sameDay : addDays(sameDay, -1);
}

/**
 * The `YYYY-MM-DD` dates within [start, spanEnd] whose weekday is in `weekdays`
 * (0 = Monday … 6 = Sunday). Empty `weekdays` → no dates. Capped at MAX_OCCURRENCES.
 */
export function recurrenceDates(startYmd: string, span: Span, weekdays: readonly number[]): string[] {
  const wanted = new Set(weekdays);
  if (!wanted.size) return [];
  const start = parseYmd(startYmd);
  const end = ymd(spanEnd(start, span));
  const out: string[] = [];
  for (let d = start; ymd(d) <= end && out.length < MAX_OCCURRENCES; d = addDays(d, 1)) {
    if (wanted.has(dayIndex(d))) out.push(ymd(d));
  }
  return out;
}

export function newRecurrenceId(): string {
  return 'r-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9);
}

/** Builds the inputs for repo.addMany(): one task per matching date, all sharing a new recurrenceId. */
export function buildSeries(input: {
  title: string;
  time: string | null;
  startYmd: string;
  span: Span;
  weekdays: readonly number[];
}): NewTask[] {
  const recurrenceId = newRecurrenceId();
  const time = normalizeTime(input.time);
  return recurrenceDates(input.startYmd, input.span, input.weekdays).map((date) => ({
    title: input.title.trim(),
    date,
    time,
    recurrenceId,
  }));
}
