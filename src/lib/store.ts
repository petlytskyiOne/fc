// Дані застосунку:
//   • вбудована колода — колекція nkcpfr_cards;
//   • імпортовані колоди — nkcpfr_users/{uid}/decks/{deckId} (картки масивом у документі колоди);
//   • прогрес і денна статистика — nkcpfr_users/{uid}/progress і /daily.
// Офлайн-кеш і черга записів — вбудовані у Firestore.
import { createMemo, createRoot, createSignal } from 'solid-js';
import { createStore, reconcile } from 'solid-js/store';
import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  documentId,
  getDocs,
  increment,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import bundledCards from '../data/cards.json';
import { CARDS_COLLECTION, db, USERS_COLLECTION } from './firebase';
import { cardStatus, newProgress, review } from './srs';
import { sectionTitle, t } from './i18n';
import type { ParsedDeck } from './deckFormat';
import { BUILTIN_DECK_ID, type Card, type DailyStat, type Deck, type Grade, type Progress } from '../types';

type CardsSource = 'db' | 'cache' | 'bundled';

const [builtinCards, setBuiltinCards] = createSignal<Card[]>([]);
const [userDecks, setUserDecks] = createSignal<Deck[]>([]);
const [activeDeckId, setActiveDeckIdSignal] = createSignal<string>(BUILTIN_DECK_ID);
const [progress, setProgress] = createStore<Record<string, Progress>>({});
const [daily, setDaily] = createStore<Record<string, DailyStat>>({});
const [loading, setLoading] = createSignal(false);
const [cardsSource, setCardsSource] = createSignal<CardsSource | null>(null);
const [syncError, setSyncError] = createSignal<string | null>(null);
const [pendingCount, setPendingCount] = createSignal(0);
/** Вбудована колода спільна, тож «видалити» її — лише сховати для себе: у кошик чи назавжди */
const [builtinState, setBuiltinState] = createSignal<{ deletedAt?: number; removed?: boolean }>({});

export { progress, daily, loading, cardsSource, syncError, pendingCount, activeDeckId };

const progressCollection = (uid: string) => collection(db, USERS_COLLECTION, uid, 'progress');
const dailyCollection = (uid: string) => collection(db, USERS_COLLECTION, uid, 'daily');
const decksCollection = (uid: string) => collection(db, USERS_COLLECTION, uid, 'decks');
const libraryDoc = (uid: string) => doc(db, USERS_COLLECTION, uid, 'meta', 'library');

// ---------------- Колоди ----------------

function sectionsOf(list: Card[]) {
  const seen = new Map<string, string>();
  for (const c of list) if (!seen.has(c.section)) seen.set(c.section, c.section_title);
  return [...seen].map(([code, title]) => ({ code, title }));
}

// Обчислювані значення живуть увесь час роботи застосунку, тому — у власному корені
const derived = createRoot(() => {
  /** Імпортовані колоди поза кошиком */
  const library = createMemo<Deck[]>(() => userDecks().filter((d) => !d.deletedAt));
  const builtin = createMemo<Deck>(() => ({
    id: BUILTIN_DECK_ID,
    title: t('decks.builtinTitle'),
    author: '',
    description: t('decks.builtinDesc'),
    builtin: true,
    sections: sectionsOf(builtinCards()),
    cards: builtinCards(),
    deletedAt: builtinState().deletedAt,
  }));
  const builtinShown = () => !builtinState().deletedAt && !builtinState().removed;
  // Порожньою бібліотека не буває: без інших колод вбудована показується, навіть якщо прихована
  const forcedBuiltin = () => !builtinShown() && library().length === 0;
  const decks = createMemo<Deck[]>(() => [...(builtinShown() || forcedBuiltin() ? [builtin()] : []), ...library()]);
  /** Кошик: спершу видалені останніми */
  const trash = createMemo<Deck[]>(() =>
    [...userDecks(), ...(builtinState().deletedAt && !forcedBuiltin() ? [builtin()] : [])]
      .filter((d) => d.deletedAt)
      .sort((a, b) => b.deletedAt! - a.deletedAt!),
  );
  const activeDeck = createMemo<Deck>(() => decks().find((d) => d.id === activeDeckId()) ?? decks()[0]);
  /** Картки активної колоди — з ними працюють навчання, перегляд, статистика й експорт */
  const cards = createMemo<Card[]>(() => activeDeck().cards);
  /** Вбудовану видалили назавжди — у бібліотеці є посилання, щоб її повернути */
  const builtinRemoved = () => !!builtinState().removed && !forcedBuiltin();
  return { decks, trash, activeDeck, cards, builtinRemoved };
});

export const { decks, trash, activeDeck, cards, builtinRemoved } = derived;

let currentUid: string | null = null;
const deckKey = (uid: string) => `fc.deck.${uid}`;

export function setActiveDeck(id: string): void {
  setActiveDeckIdSignal(id);
  try {
    if (currentUid) localStorage.setItem(deckKey(currentUid), id);
  } catch {
    // вибір діятиме до перезапуску
  }
}

/** Мітка картки для показу: в імпортованих колодах ID має префікс колоди */
export const cardLabel = (card: Card) => card.id.split('~').pop() ?? card.id;

const deckIdOf = (card: Card) => (card.id.includes('~') ? card.id.split('~')[0] : BUILTIN_DECK_ID);

/** Ключ розділу в денній статистиці (у вбудованій колоді — просто код, як і раніше) */
export function sectionStatKey(code: string, deckId = activeDeckId()): string {
  return deckId === BUILTIN_DECK_ID ? code : `${deckId}~${code}`;
}

/** Назва розділу: у вбудованій колоді перекладається, в імпортованих — як у файлі */
export function sectionName(code: string, fallback: string): string {
  return activeDeck().builtin ? sectionTitle(code, fallback) : fallback;
}

// ---------------- Сесія ----------------

/** Локальна дата YYYY-MM-DD (не UTC — день має збігатися з днем користувача) */
export function dayKey(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

let unsubscribers: Unsubscribe[] = [];

function stopListeners(): void {
  unsubscribers.forEach((u) => u());
  unsubscribers = [];
}

export function startSession(uid: string): void {
  stopListeners();
  currentUid = uid;
  setLoading(true);
  setSyncError(null);
  try {
    setActiveDeckIdSignal(localStorage.getItem(deckKey(uid)) ?? BUILTIN_DECK_ID);
  } catch {
    setActiveDeckIdSignal(BUILTIN_DECK_ID);
  }

  unsubscribers.push(
    onSnapshot(
      query(collection(db, CARDS_COLLECTION), orderBy('position')),
      (snap) => {
        if (snap.empty) {
          setBuiltinCards(bundledCards as Card[]);
          setCardsSource('bundled');
          if (!snap.metadata.fromCache) setSyncError(t('data.emptyCards'));
        } else {
          setBuiltinCards(snap.docs.map((d) => d.data() as Card));
          setCardsSource(snap.metadata.fromCache ? 'cache' : 'db');
          setSyncError(null);
        }
        setLoading(false);
      },
      (error) => {
        setBuiltinCards(bundledCards as Card[]);
        setCardsSource('bundled');
        setSyncError(t('data.cardsFailed', { msg: error.message }));
        setLoading(false);
      },
    ),
  );

  unsubscribers.push(
    onSnapshot(
      decksCollection(uid),
      (snap) => {
        const list = snap.docs.map((d) => ({ ...(d.data() as Omit<Deck, 'id' | 'builtin'>), id: d.id, builtin: false }));
        list.sort((a, b) => a.title.localeCompare(b.title, 'uk'));
        setUserDecks(list);
      },
      (error) => setSyncError(t('data.decksFailed', { msg: error.message })),
    ),
  );

  unsubscribers.push(
    onSnapshot(
      libraryDoc(uid),
      (snap) => {
        const data = snap.data() ?? {};
        setBuiltinState({ deletedAt: data.builtinDeletedAt, removed: data.builtinRemoved });
      },
      (error) => setSyncError(t('data.decksFailed', { msg: error.message })),
    ),
  );

  unsubscribers.push(
    onSnapshot(
      progressCollection(uid),
      { includeMetadataChanges: true },
      (snap) => {
        const map: Record<string, Progress> = {};
        let pending = 0;
        for (const d of snap.docs) {
          map[d.id] = d.data() as Progress;
          if (d.metadata.hasPendingWrites) pending++;
        }
        setProgress(reconcile(map));
        setPendingCount(pending);
      },
      (error) => setSyncError(t('data.progressFailed', { msg: error.message })),
    ),
  );

  unsubscribers.push(
    onSnapshot(
      dailyCollection(uid),
      (snap) => {
        const map: Record<string, DailyStat> = {};
        for (const d of snap.docs) map[d.id] = d.data() as DailyStat;
        setDaily(reconcile(map));
      },
      (error) => setSyncError(t('data.statsFailed', { msg: error.message })),
    ),
  );
}

type Counts = Record<'new' | 'learning' | 'review' | 'mastered', number>;

function countsFor(list: Card[]): Counts {
  const counts = { new: 0, learning: 0, review: 0, mastered: 0 };
  for (const card of list) counts[cardStatus(progress[card.id])]++;
  return counts;
}

/** Скільки карток активної колоди у кожному стані зараз */
export const statusCounts = (): Counts => countsFor(cards());

export function gradeCard(uid: string, card: Card, grade: Grade, ms: number): void {
  const before = progress[card.id];
  const next = review(before ?? newProgress(card.id), grade);
  setProgress(card.id, next);

  const fail = (error: Error) => setSyncError(t('data.saveFailed', { msg: error.message }));
  // Не чекаємо підтвердження сервера: офлайн запис стоїть у черзі Firestore
  setDoc(doc(progressCollection(uid), card.id), next).catch(fail);

  const now = new Date();
  const hour = String(now.getHours()).padStart(2, '0');
  const builtin = countsFor(builtinCards());
  // Знімок по кожній колоді — з нього будується крива росту для вибраної колоди
  const perDeck = Object.fromEntries(
    decks().map((d) => {
      const c = countsFor(d.cards);
      return [d.id, { learning: c.learning, review: c.review, mastered: c.mastered, total: d.cards.length }];
    }),
  );
  setDoc(
    doc(dailyCollection(uid), dayKey(now)),
    {
      date: dayKey(now),
      reviews: increment(1),
      [`g${grade}`]: increment(1),
      new_cards: increment(cardStatus(before) === 'new' ? 1 : 0),
      ms: increment(Math.min(ms, 5 * 60_000)),
      hours: { [hour]: increment(1) },
      sections: { [sectionStatKey(card.section, deckIdOf(card))]: { n: increment(1), ok: increment(grade >= 2 ? 1 : 0) } },
      learning: builtin.learning,
      review: builtin.review,
      mastered: builtin.mastered,
      total: builtinCards().length,
      decks: perDeck,
    },
    { merge: true },
  ).catch(fail);
}

// ---------------- Бібліотека: імпорт, кошик, видалення ----------------

/** Колода з бібліотеки з такою самою назвою (для оновлення замість дубля); кошик не враховуємо */
export function findDeckByTitle(title: string): Deck | undefined {
  const norm = title.trim().toLowerCase();
  return userDecks().find((d) => !d.deletedAt && d.title.trim().toLowerCase() === norm);
}

const MAX_DECK_BYTES = 900_000; // Firestore обмежує документ 1 МБ

export async function saveDeck(uid: string, parsed: ParsedDeck, replaceId?: string): Promise<string> {
  const id = replaceId ?? `d${Date.now().toString(36)}`;
  let position = 0;
  const deckCards: Card[] = parsed.sections.flatMap((s) =>
    s.cards.map((c, i) => ({
      id: `${id}~${s.code}.${i + 1}`,
      section: s.code,
      section_title: s.title,
      num: String(i + 1),
      position: ++position,
      question: c.question,
      answer: c.answer,
    })),
  );
  const data = {
    title: parsed.title,
    author: parsed.author,
    description: parsed.description,
    sections: parsed.sections.map((s) => ({ code: s.code, title: s.title })),
    cards: deckCards,
    updatedAt: Date.now(),
  };
  if (new TextEncoder().encode(JSON.stringify(data)).length > MAX_DECK_BYTES) throw new Error('deck_too_big');
  await setDoc(doc(decksCollection(uid), id), data);
  return id;
}

/** У кошик: колода зникає з бібліотеки, але її картки й прогрес лишаються до остаточного видалення */
export async function trashDeck(uid: string, id: string): Promise<void> {
  // активною стає інша колода з бібліотеки
  if (activeDeckId() === id) setActiveDeck(decks().find((d) => d.id !== id)?.id ?? BUILTIN_DECK_ID);
  if (id === BUILTIN_DECK_ID) await setDoc(libraryDoc(uid), { builtinDeletedAt: Date.now() }, { merge: true });
  else await updateDoc(doc(decksCollection(uid), id), { deletedAt: Date.now() });
}

export async function restoreDeck(uid: string, id: string): Promise<void> {
  if (id === BUILTIN_DECK_ID) await setDoc(libraryDoc(uid), { builtinDeletedAt: deleteField() }, { merge: true });
  else await updateDoc(doc(decksCollection(uid), id), { deletedAt: deleteField() });
}

/** Повернути вбудовану колоду, видалену назавжди (з нуля — її прогрес уже стерто) */
export async function bringBackBuiltin(uid: string): Promise<void> {
  await setDoc(libraryDoc(uid), { builtinDeletedAt: deleteField(), builtinRemoved: deleteField() }, { merge: true });
}

/** Остаточне видалення колоди разом із прогресом її карток */
export async function deleteDeck(uid: string, id: string): Promise<void> {
  if (id === BUILTIN_DECK_ID) return removeBuiltin(uid);
  // Прогрес карток колоди: ID документів починаються з «{deckId}~»
  const prefix = `${id}~`;
  const snap = await getDocs(
    query(progressCollection(uid), where(documentId(), '>=', prefix), where(documentId(), '<', `${prefix}`)),
  );
  for (let i = 0; i < snap.docs.length; i += 450) {
    const batch = writeBatch(db);
    snap.docs.slice(i, i + 450).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
  await deleteDoc(doc(decksCollection(uid), id));
  if (activeDeckId() === id) setActiveDeck(BUILTIN_DECK_ID);
}

/** Вбудовану колоду не стерти для всіх — ховаємо її для себе назавжди і стираємо свій прогрес по ній */
async function removeBuiltin(uid: string): Promise<void> {
  // прогрес вбудованої колоди — документи без префікса колоди
  const snap = await getDocs(progressCollection(uid));
  const refs = snap.docs.filter((d) => !d.id.includes('~')).map((d) => d.ref);
  for (let i = 0; i < refs.length; i += 450) {
    const batch = writeBatch(db);
    refs.slice(i, i + 450).forEach((ref) => batch.delete(ref));
    await batch.commit();
  }
  await setDoc(libraryDoc(uid), { builtinDeletedAt: deleteField(), builtinRemoved: true }, { merge: true });
}

// ---------------- Скидання ----------------

export async function resetProgress(uid: string): Promise<string | null> {
  try {
    const [p, d] = await Promise.all([getDocs(progressCollection(uid)), getDocs(dailyCollection(uid))]);
    const refs = [...p.docs, ...d.docs].map((x) => x.ref);
    // Firestore обмежує пакет 500 операціями
    for (let i = 0; i < refs.length; i += 450) {
      const batch = writeBatch(db);
      refs.slice(i, i + 450).forEach((ref) => batch.delete(ref));
      await batch.commit();
    }
    setProgress(reconcile({}));
    setDaily(reconcile({}));
    return null;
  } catch (error) {
    return (error as Error).message;
  }
}

export function clearSession(): void {
  stopListeners();
  currentUid = null;
  setBuiltinCards([]);
  setUserDecks([]);
  setBuiltinState({});
  setActiveDeckIdSignal(BUILTIN_DECK_ID);
  setProgress(reconcile({}));
  setDaily(reconcile({}));
  setCardsSource(null);
  setSyncError(null);
  setPendingCount(0);
}

export interface SectionInfo {
  code: string;
  title: string;
  cards: Card[];
}

/** Розділи активної колоди в порядку файлів */
export function sections(): SectionInfo[] {
  return deckSections(activeDeck());
}

/** Розділи будь-якої колоди в порядку файлів */
export function deckSections(deck: Deck): SectionInfo[] {
  const map = new Map<string, SectionInfo>();
  for (const s of deck.sections) map.set(s.code, { code: s.code, title: s.title, cards: [] });
  for (const card of deck.cards) {
    let s = map.get(card.section);
    if (!s) {
      s = { code: card.section, title: card.section_title, cards: [] };
      map.set(card.section, s);
    }
    s.cards.push(card);
  }
  return [...map.values()].filter((s) => s.cards.length > 0);
}
