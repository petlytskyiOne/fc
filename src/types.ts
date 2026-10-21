export interface Card {
  id: string;
  section: string;
  section_title: string;
  num: string;
  position: number;
  question: string;
  answer: string;
}

export interface Progress {
  card_id: string;
  ease: number;
  interval_days: number;
  repetitions: number;
  lapses: number;
  due_at: string;
  last_grade: number | null;
  reviewed_at: string | null;
}

/** 0 — не знаю, 1 — важко, 2 — знаю, 3 — легко */
export type Grade = 0 | 1 | 2 | 3;

export type CardStatus = 'new' | 'learning' | 'review' | 'mastered';

/**
 * Денна статистика: nkcpfr_users/{uid}/daily/{YYYY-MM-DD}.
 * Лічильники накопичуються за день; learning/review/mastered — знімок стану всіх карток
 * після останньої оцінки цього дня (з них будується крива росту).
 */
export interface DailyStat {
  date: string;
  reviews: number;
  g0: number;
  g1: number;
  g2: number;
  g3: number;
  new_cards: number;
  ms: number;
  hours?: Record<string, number>;
  sections?: Record<string, { n: number; ok: number }>;
  learning: number;
  review: number;
  mastered: number;
  total: number;
  /** Знімок стану по кожній колоді (з'явився з імпортом колод) */
  decks?: Record<string, { learning: number; review: number; mastered: number; total: number }>;
}

export interface DeckSection {
  code: string;
  title: string;
}

/**
 * Колода карток. Вбудована («Співбесіда НКЦПФР») читається з nkcpfr_cards,
 * імпортовані — з nkcpfr_users/{uid}/decks/{deckId}.
 */
export interface Deck {
  id: string;
  title: string;
  author: string;
  description: string;
  builtin: boolean;
  sections: DeckSection[];
  cards: Card[];
  updatedAt?: number;
  /** Колода в кошику: коли туди потрапила (відновлюється разом із прогресом) */
  deletedAt?: number;
}

/** ID вбудованої колоди */
export const BUILTIN_DECK_ID = 'nkcpfr';
