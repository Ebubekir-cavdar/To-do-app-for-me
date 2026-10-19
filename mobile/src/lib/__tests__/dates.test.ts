/// <reference types="jest" />
import {
  addDays,
  dayIndex,
  dayLabel,
  fmtRange,
  isoWeek,
  mondayOf,
  parseYmd,
  weekDays,
  weeksBetween,
  ymd,
} from '../dates';

// All dates are built with the local-time constructor, so these tests hold in any time zone.
const d = (y: number, m: number, day: number, h = 12, min = 0) => new Date(y, m - 1, day, h, min);

describe('ymd / parseYmd', () => {
  it('formats local dates with zero padding', () => {
    expect(ymd(d(2026, 1, 5))).toBe('2026-01-05');
    expect(ymd(d(2026, 12, 31))).toBe('2026-12-31');
  });

  it('never shifts the day near midnight (no UTC conversion)', () => {
    expect(ymd(d(2026, 10, 17, 0, 0))).toBe('2026-10-17');
    expect(ymd(new Date(2026, 9, 17, 0, 0, 0, 1))).toBe('2026-10-17');
    expect(ymd(new Date(2026, 9, 17, 23, 59, 59, 999))).toBe('2026-10-17');
    expect(ymd(new Date(2025, 11, 31, 23, 59, 59, 999))).toBe('2025-12-31');
    expect(ymd(new Date(2026, 0, 1, 0, 0, 0, 0))).toBe('2026-01-01');
  });

  it('round-trips through parseYmd at local midnight', () => {
    for (const s of ['2026-01-01', '2026-02-28', '2028-02-29', '2026-10-17', '2026-12-31']) {
      const p = parseYmd(s);
      expect(ymd(p)).toBe(s);
      expect([p.getHours(), p.getMinutes()]).toEqual([0, 0]);
    }
  });
});

describe('addDays', () => {
  it('crosses month and year boundaries', () => {
    expect(ymd(addDays(d(2026, 1, 31), 1))).toBe('2026-02-01');
    expect(ymd(addDays(d(2025, 12, 31), 1))).toBe('2026-01-01');
    expect(ymd(addDays(d(2026, 1, 1), -1))).toBe('2025-12-31');
    expect(ymd(addDays(d(2028, 2, 28), 1))).toBe('2028-02-29');
  });
});

describe('weeks start on Monday', () => {
  it('dayIndex: Monday 0 … Sunday 6', () => {
    expect(dayIndex(d(2026, 10, 12))).toBe(0); // Monday
    expect(dayIndex(d(2026, 10, 17))).toBe(5); // Saturday
    expect(dayIndex(d(2026, 10, 18))).toBe(6); // Sunday
  });

  it('mondayOf a Monday is itself, at midnight', () => {
    const m = mondayOf(d(2026, 10, 12, 23, 59));
    expect(ymd(m)).toBe('2026-10-12');
    expect(m.getHours()).toBe(0);
  });

  it('mondayOf a Sunday is the Monday before (not the next one)', () => {
    expect(ymd(mondayOf(d(2026, 10, 18, 0, 1)))).toBe('2026-10-12');
    expect(ymd(mondayOf(d(2026, 10, 18, 23, 59)))).toBe('2026-10-12');
  });

  it('handles the 29 Dec 2025 – 4 Jan 2026 week across the year boundary', () => {
    expect(ymd(mondayOf(d(2026, 1, 1)))).toBe('2025-12-29');
    expect(ymd(mondayOf(d(2026, 1, 4)))).toBe('2025-12-29');
    expect(ymd(mondayOf(d(2026, 1, 5)))).toBe('2026-01-05');
    expect(weekDays(parseYmd('2025-12-29')).map(ymd)).toEqual([
      '2025-12-29',
      '2025-12-30',
      '2025-12-31',
      '2026-01-01',
      '2026-01-02',
      '2026-01-03',
      '2026-01-04',
    ]);
  });

  it('weekDays returns Mon..Sun', () => {
    const days = weekDays(parseYmd('2026-10-12'));
    expect(days.map(dayIndex)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(ymd(days[6])).toBe('2026-10-18');
  });

  it('weeksBetween counts whole weeks, including across years', () => {
    expect(weeksBetween(parseYmd('2026-10-12'), parseYmd('2026-10-19'))).toBe(1);
    expect(weeksBetween(parseYmd('2026-10-12'), parseYmd('2026-10-05'))).toBe(-1);
    expect(weeksBetween(parseYmd('2025-12-29'), parseYmd('2026-12-28'))).toBe(52);
  });
});

describe('dayLabel (Turkish)', () => {
  it('names every weekday in Turkish, Monday first', () => {
    const labels = weekDays(parseYmd('2026-10-12')).map(dayLabel);
    expect(labels).toEqual([
      'Pazartesi · 12 Ekim',
      'Salı · 13 Ekim',
      'Çarşamba · 14 Ekim',
      'Perşembe · 15 Ekim',
      'Cuma · 16 Ekim',
      'Cumartesi · 17 Ekim',
      'Pazar · 18 Ekim',
    ]);
  });

  it('uses Turkish month names', () => {
    expect(dayLabel(d(2026, 2, 1))).toBe('Pazar · 1 Şubat');
    expect(dayLabel(d(2026, 8, 31))).toBe('Pazartesi · 31 Ağustos');
    expect(dayLabel(d(2025, 12, 29))).toBe('Pazartesi · 29 Aralık');
  });
});

describe('fmtRange', () => {
  it('same month', () => {
    expect(fmtRange(d(2026, 10, 12), d(2026, 10, 18))).toBe('12 – 18 Ekim 2026');
  });

  it('crosses a month', () => {
    expect(fmtRange(d(2026, 10, 26), d(2026, 11, 1))).toBe('26 Ekim – 1 Kasım 2026');
  });

  it('crosses a year', () => {
    expect(fmtRange(d(2025, 12, 29), d(2026, 1, 4))).toBe('29 Aralık 2025 – 4 Ocak 2026');
  });
});

describe('isoWeek', () => {
  it.each([
    ['2026-01-01', 1], // Thursday
    ['2025-12-29', 1], // Monday of ISO week 2026-W01
    ['2026-01-04', 1],
    ['2026-01-05', 2],
    ['2026-10-17', 42],
    ['2026-12-31', 53], // 2026 starts on Thursday → 53 weeks
    ['2027-01-01', 53], // still 2026-W53
    ['2027-01-03', 53],
    ['2027-01-04', 1],
    ['2021-01-03', 53], // Sunday, belongs to 2020-W53
    ['2021-01-04', 1],
    ['2024-12-30', 1], // Monday, belongs to 2025-W01
  ])('%s → %i', (s, w) => {
    expect(isoWeek(parseYmd(s))).toBe(w);
    // Time of day must not matter.
    const late = parseYmd(s);
    late.setHours(23, 59);
    expect(isoWeek(late)).toBe(w);
  });
});
