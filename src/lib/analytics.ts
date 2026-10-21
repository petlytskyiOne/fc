// Розрахунки для екрана «Статистика» на основі денних документів nkcpfr_users/{uid}/daily.
import { dayKey } from './store';
import { formatDate, t } from './i18n';
import type { DailyStat } from '../types';

export type Period = 'day' | 'week' | 'month' | 'year';

export const periodLabel = (p: Period) => t(`period.${p}`);
export const prevLabel = (p: Period) => t(`prev.${p}`);

// Назви місяців і днів тижня — мовою інтерфейсу
const monthShort = (d: Date) => formatDate(d, { month: 'short' }).replace('.', '');
const monthYear = (d: Date) => formatDate(d, { month: 'long', year: 'numeric' });
const weekdayShort = (d: Date) => formatDate(d, { weekday: 'short' }).replace('.', '');
const dayMonth = (d: Date) => formatDate(d, { day: 'numeric', month: 'short' });
const weekdayDayMonth = (d: Date) => formatDate(d, { weekday: 'short', day: 'numeric', month: 'short' });
const fullDate = (d: Date) => formatDate(d, { day: 'numeric', month: 'short', year: 'numeric' });

const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export interface Totals {
  reviews: number;
  g: [number, number, number, number];
  newCards: number;
  ms: number;
  activeDays: number;
}

function emptyTotals(): Totals {
  return { reviews: 0, g: [0, 0, 0, 0], newCards: 0, ms: 0, activeDays: 0 };
}

function addStat(t: Totals, s: DailyStat | undefined): void {
  if (!s) return;
  t.reviews += s.reviews ?? 0;
  t.g[0] += s.g0 ?? 0;
  t.g[1] += s.g1 ?? 0;
  t.g[2] += s.g2 ?? 0;
  t.g[3] += s.g3 ?? 0;
  t.newCards += s.new_cards ?? 0;
  t.ms += s.ms ?? 0;
  if ((s.reviews ?? 0) > 0) t.activeDays++;
}

/** Дні, що входять у період, що закінчується сьогодні (offset = 1 — попередній такий самий період) */
function periodDays(period: Period, today: Date, offset = 0): Date[] {
  const length = period === 'day' ? 1 : period === 'week' ? 7 : period === 'month' ? 30 : 365;
  const end = addDays(today, -length * offset);
  return Array.from({ length }, (_, i) => addDays(end, i - length + 1));
}

export function totals(daily: Record<string, DailyStat>, period: Period, today: Date, offset = 0): Totals {
  const t = emptyTotals();
  for (const d of periodDays(period, today, offset)) addStat(t, daily[dayKey(d)]);
  return t;
}

export interface Bucket {
  key: string;
  label: string;
  /** Повний підпис для підказки */
  title: string;
  value: number;
  current: boolean;
}

/** Стовпці активності: година / день / день / місяць */
export function activityBuckets(daily: Record<string, DailyStat>, period: Period, now: Date): Bucket[] {
  const today = startOfDay(now);
  if (period === 'day') {
    const hours = daily[dayKey(today)]?.hours ?? {};
    return Array.from({ length: 24 }, (_, h) => {
      const hh = String(h).padStart(2, '0');
      return { key: hh, label: hh, title: `${hh}:00–${hh}:59`, value: hours[hh] ?? 0, current: h === now.getHours() };
    });
  }
  if (period === 'year') {
    return Array.from({ length: 12 }, (_, i) => {
      const m = new Date(today.getFullYear(), today.getMonth() - 11 + i, 1);
      const prefix = dayKey(m).slice(0, 7);
      let value = 0;
      for (const [k, s] of Object.entries(daily)) if (k.startsWith(prefix)) value += s.reviews ?? 0;
      return {
        key: prefix,
        label: monthShort(m),
        title: monthYear(m),
        value,
        current: i === 11,
      };
    });
  }
  return periodDays(period, today).map((d, i, all) => ({
    key: dayKey(d),
    label: period === 'week' ? weekdayShort(d) : String(d.getDate()),
    title: weekdayDayMonth(d),
    value: daily[dayKey(d)]?.reviews ?? 0,
    current: i === all.length - 1,
  }));
}

export interface GrowthPoint {
  key: string;
  label: string;
  title: string;
  /** засвоєно: повторення + вивчені */
  learned: number;
  /** вивчено: інтервал від 21 дня */
  mastered: number;
}

/**
 * Крива росту: стан бази на кінець кожного дня / місяця.
 * Беремо останній денний знімок не пізніше кінця відрізка (дні без занять продовжують попередній стан).
 */
export function growthSeries(
  daily: Record<string, DailyStat>,
  period: Period,
  now: Date,
  deckId: string,
  builtin: boolean,
): GrowthPoint[] {
  const today = startOfDay(now);
  const keys = Object.keys(daily).sort();
  // Знімок вибраної колоди; для вбудованої колоди старі дні без поля decks беруть верхньорівневі значення
  const pick = (s: DailyStat) => s.decks?.[deckId] ?? (builtin ? s : undefined);
  const snapshotAt = (key: string) => {
    let found: { review: number; mastered: number } | undefined;
    for (const k of keys) {
      if (k > key) break;
      found = pick(daily[k]) ?? found;
    }
    return { learned: (found?.review ?? 0) + (found?.mastered ?? 0), mastered: found?.mastered ?? 0 };
  };

  if (period === 'year') {
    return Array.from({ length: 12 }, (_, i) => {
      const monthEnd = new Date(today.getFullYear(), today.getMonth() - 10 + i, 0);
      const end = i === 11 ? today : monthEnd;
      const m = new Date(end.getFullYear(), end.getMonth(), 1);
      return { key: dayKey(end), label: monthShort(m), title: t('stats.endOf', { date: monthYear(m) }), ...snapshotAt(dayKey(end)) };
    });
  }
  const days = period === 'day' ? periodDays('week', today) : periodDays(period, today);
  return days.map((d) => ({
    key: dayKey(d),
    label: period === 'month' ? String(d.getDate()) : weekdayShort(d),
    title: dayMonth(d),
    ...snapshotAt(dayKey(d)),
  }));
}

/** Поточна серія днів поспіль із заняттями (сьогодні ще можна продовжити) і найдовша серія */
export function streaks(daily: Record<string, DailyStat>, now: Date): { current: number; best: number } {
  const active = new Set(Object.values(daily).filter((s) => (s.reviews ?? 0) > 0).map((s) => s.date));
  let day = startOfDay(now);
  if (!active.has(dayKey(day))) day = addDays(day, -1);
  let current = 0;
  while (active.has(dayKey(day))) {
    current++;
    day = addDays(day, -1);
  }

  let best = 0;
  let run = 0;
  let prev: Date | null = null;
  for (const key of [...active].sort()) {
    const [y, m, d] = key.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    run = prev && dayKey(addDays(prev, 1)) === key ? run + 1 : 1;
    best = Math.max(best, run);
    prev = date;
  }
  return { current, best };
}

export interface HeatCell {
  key: string;
  title: string;
  value: number;
  future: boolean;
}

/** Теплова карта за останні 53 тижні: колонки — тижні (пн–нд) */
export function heatmap(daily: Record<string, DailyStat>, now: Date): { weeks: HeatCell[][]; months: { col: number; label: string }[] } {
  const today = startOfDay(now);
  const mondayOffset = (today.getDay() + 6) % 7;
  const start = addDays(today, -mondayOffset - 52 * 7);
  const weeks: HeatCell[][] = [];
  const months: { col: number; label: string }[] = [];
  let lastMonth = -1;
  for (let w = 0; w < 53; w++) {
    const col: HeatCell[] = [];
    for (let i = 0; i < 7; i++) {
      const d = addDays(start, w * 7 + i);
      if (i === 0 && d.getMonth() !== lastMonth) {
        months.push({ col: w, label: monthShort(d) });
        lastMonth = d.getMonth();
      }
      col.push({
        key: dayKey(d),
        title: fullDate(d),
        value: daily[dayKey(d)]?.reviews ?? 0,
        future: d > today,
      });
    }
    weeks.push(col);
  }
  return { weeks, months };
}

export interface SectionPeriodStat {
  n: number;
  ok: number;
}

export function sectionTotals(daily: Record<string, DailyStat>, period: Period, today: Date): Record<string, SectionPeriodStat> {
  const out: Record<string, SectionPeriodStat> = {};
  for (const d of periodDays(period, today)) {
    const s = daily[dayKey(d)]?.sections;
    if (!s) continue;
    for (const [code, v] of Object.entries(s)) {
      const t = (out[code] ??= { n: 0, ok: 0 });
      t.n += v.n ?? 0;
      t.ok += v.ok ?? 0;
    }
  }
  return out;
}

export function formatDuration(ms: number): string {
  const minutes = Math.round(ms / 60_000);
  if (minutes < 1) return ms > 0 ? t('dur.lessMin') : t('dur.zero');
  if (minutes < 60) return t('dur.min', { m: minutes });
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? t('dur.hourMin', { h, m }) : t('dur.hour', { h });
}

/** Округлення верхньої межі осі до «чистого» числа */
export function niceMax(value: number): number {
  if (value <= 4) return 4;
  const pow = 10 ** Math.floor(Math.log10(value));
  for (const step of [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) {
    if (step * pow >= value) return step * pow;
  }
  return 10 * pow;
}
