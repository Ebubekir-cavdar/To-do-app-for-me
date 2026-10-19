import { parseYmd, ymd } from '../dates';
import { buildSeries, EVERY_DAY, MAX_OCCURRENCES, recurrenceDates, spanEnd } from '../recurrence';

const end = (start: string, unit: 'week' | 'month', count: number) => ymd(spanEnd(parseYmd(start), { unit, count }));

describe('spanEnd', () => {
  it('weeks end the day before the same weekday', () => {
    expect(end('2026-10-20', 'week', 1)).toBe('2026-10-26');
    expect(end('2026-10-17', 'week', 2)).toBe('2026-10-30');
  });
  it('months end the day before the same date next month', () => {
    expect(end('2026-10-17', 'month', 1)).toBe('2026-11-16');
    expect(end('2026-10-01', 'month', 1)).toBe('2026-10-31');
    expect(end('2026-12-15', 'month', 1)).toBe('2027-01-14');
    expect(end('2026-10-17', 'month', 3)).toBe('2027-01-16');
  });
  it('clamps to the end of a shorter month', () => {
    expect(end('2026-01-31', 'month', 1)).toBe('2026-02-28');
    expect(end('2028-01-31', 'month', 1)).toBe('2028-02-29');
    expect(end('2026-03-31', 'month', 1)).toBe('2026-04-30');
  });
});

describe('recurrenceDates', () => {
  it('every day for one month from 17 Oct 2026 = 31 dates', () => {
    const d = recurrenceDates('2026-10-17', { unit: 'month', count: 1 }, EVERY_DAY);
    expect(d).toHaveLength(31);
    expect(d[0]).toBe('2026-10-17');
    expect(d[d.length - 1]).toBe('2026-11-16');
  });
  it('Mondays and Wednesdays only (0 = Monday, 2 = Wednesday)', () => {
    const d = recurrenceDates('2026-10-17', { unit: 'month', count: 1 }, [0, 2]);
    expect(d).toEqual(['2026-10-19', '2026-10-21', '2026-10-26', '2026-10-28', '2026-11-02', '2026-11-04', '2026-11-09', '2026-11-11', '2026-11-16']);
  });
  it('no weekdays → no dates', () => {
    expect(recurrenceDates('2026-10-17', { unit: 'week', count: 1 }, [])).toEqual([]);
  });
  it('is capped', () => {
    expect(recurrenceDates('2026-01-01', { unit: 'month', count: 12 }, EVERY_DAY)).toHaveLength(MAX_OCCURRENCES);
  });
});

describe('buildSeries', () => {
  it('shares one recurrenceId, trims title, normalizes time', () => {
    const s = buildSeries({ title: '  Spor  ', time: '7:30', startYmd: '2026-10-19', span: { unit: 'week', count: 1 }, weekdays: [0, 4] });
    expect(s.map((t) => t.date)).toEqual(['2026-10-19', '2026-10-23']);
    expect(new Set(s.map((t) => t.recurrenceId)).size).toBe(1);
    expect(s[0].recurrenceId).toMatch(/^r-/);
    expect(s.every((t) => t.title === 'Spor' && t.time === null)).toBe(true);
    const s2 = buildSeries({ title: 'Ders', time: '18:00', startYmd: '2026-10-19', span: { unit: 'week', count: 1 }, weekdays: [0] });
    expect(s2[0].time).toBe('18:00');
    expect(s2[0].recurrenceId).not.toBe(s[0].recurrenceId);
  });
});
