// Спрощений SM-2: інтервал росте з кожною успішною відповіддю, помилка повертає картку на початок.
import type { CardStatus, Grade, Progress } from '../types';
import { t } from './i18n';

const MINUTE = 60_000;
const DAY = 86_400_000;
const MIN_EASE = 1.3;

const round2 = (n: number) => Math.round(n * 100) / 100;

export function newProgress(cardId: string): Progress {
  return {
    card_id: cardId,
    ease: 2.5,
    interval_days: 0,
    repetitions: 0,
    lapses: 0,
    due_at: new Date().toISOString(),
    last_grade: null,
    reviewed_at: null,
  };
}

function nextInterval(p: Progress, grade: Grade): number {
  const reps = p.repetitions;
  switch (grade) {
    case 0:
      return 0;
    case 1:
      return reps === 0 ? 0.5 : Math.max(1, p.interval_days * 1.2);
    case 2:
      return reps === 0 ? 1 : reps === 1 ? 3 : p.interval_days * p.ease;
    case 3:
      return (reps === 0 ? 2 : reps === 1 ? 4 : p.interval_days * p.ease) * 1.3;
  }
}

export function review(p: Progress, grade: Grade, now = new Date()): Progress {
  const interval = nextInterval(p, grade);
  let ease = p.ease;
  if (grade === 0) ease -= 0.2;
  if (grade === 1) ease -= 0.15;
  if (grade === 3) ease += 0.15;

  const dueMs = grade === 0 ? now.getTime() + 10 * MINUTE : now.getTime() + interval * DAY;
  return {
    ...p,
    ease: round2(Math.max(MIN_EASE, ease)),
    interval_days: round2(interval),
    repetitions: grade === 0 ? 0 : p.repetitions + 1,
    lapses: grade === 0 ? p.lapses + 1 : p.lapses,
    due_at: new Date(dueMs).toISOString(),
    last_grade: grade,
    reviewed_at: now.toISOString(),
  };
}

export function isDue(p: Progress | undefined, now = Date.now()): boolean {
  return !p || new Date(p.due_at).getTime() <= now;
}

export function cardStatus(p: Progress | undefined): CardStatus {
  if (!p || p.reviewed_at === null) return 'new';
  if (p.repetitions < 2) return 'learning';
  if (p.interval_days >= 21) return 'mastered';
  return 'review';
}

export function intervalLabel(p: Progress | undefined, grade: Grade): string {
  if (grade === 0) return t('interval.min', { n: 10 });
  const days = nextInterval(p ?? newProgress(''), grade);
  if (days < 1) return t('interval.hour', { n: Math.round(days * 24) });
  if (days < 30) return t('interval.day', { n: Math.round(days) });
  return t('interval.month', { n: Math.round(days / 30) });
}

export const statusLabel = (status: CardStatus) => t(`status.${status}`);
