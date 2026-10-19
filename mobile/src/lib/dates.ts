/**
 * Local-calendar date helpers. Dates are `YYYY-MM-DD` strings built from local
 * getters — never toISOString(), which shifts the day across UTC midnight.
 * Weeks start on Monday.
 */

export const DAYS = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'] as const;
export const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'] as const;

const pad = (n: number) => (n < 10 ? '0' : '') + n;

export function ymd(d: Date): string {
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}

export function parseYmd(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** 0 = Monday … 6 = Sunday. */
export function dayIndex(d: Date): number {
  return (d.getDay() + 6) % 7;
}

export function mondayOf(d: Date): Date {
  return addDays(startOfDay(d), -dayIndex(d));
}

/** The 7 dates (Mon–Sun) of the week starting at `monday`. */
export function weekDays(monday: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

/** `Pazartesi · 13 Ekim` */
export function dayLabel(d: Date): string {
  return DAYS[dayIndex(d)] + ' · ' + d.getDate() + ' ' + MONTHS[d.getMonth()];
}

/** `13 – 19 Ekim 2026`, `27 Ekim – 2 Kasım 2026`, `29 Aralık 2025 – 4 Ocak 2026` */
export function fmtRange(a: Date, b: Date): string {
  if (a.getFullYear() !== b.getFullYear()) {
    return `${a.getDate()} ${MONTHS[a.getMonth()]} ${a.getFullYear()} – ${b.getDate()} ${MONTHS[b.getMonth()]} ${b.getFullYear()}`;
  }
  if (a.getMonth() !== b.getMonth()) {
    return `${a.getDate()} ${MONTHS[a.getMonth()]} – ${b.getDate()} ${MONTHS[b.getMonth()]} ${b.getFullYear()}`;
  }
  return `${a.getDate()} – ${b.getDate()} ${MONTHS[b.getMonth()]} ${b.getFullYear()}`;
}

/** ISO-8601 week number (weeks start Monday, week 1 contains the year's first Thursday). */
export function isoWeek(d: Date): number {
  const t = startOfDay(d);
  const thursday = addDays(t, 3 - dayIndex(t));
  const jan1 = new Date(thursday.getFullYear(), 0, 1);
  return 1 + Math.floor(Math.round((thursday.getTime() - jan1.getTime()) / 86400000) / 7);
}

/** Whole weeks between two Mondays (b - a). */
export function weeksBetween(a: Date, b: Date): number {
  return Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / (7 * 86400000));
}
