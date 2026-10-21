import { createEffect, createMemo, createSignal, For, Match, on, onCleanup, onMount, Show, Switch, untrack } from 'solid-js';
import { useNavigate, useSearchParams } from '@solidjs/router';
import HomeAnalysis from '../components/HomeAnalysis';
import Markdown from '../components/Markdown';
import { useAuth } from '../lib/auth';
import { cardStatus, intervalLabel, isDue, statusLabel } from '../lib/srs';
import { t } from '../lib/i18n';
import { cardLabel, cards, gradeCard, progress, sectionName } from '../lib/store';
import type { Card, Grade } from '../types';

const GRADES: { grade: Grade; cls: string }[] = [
  { grade: 0, cls: 'g0' },
  { grade: 1, cls: 'g1' },
  { grade: 2, cls: 'g2' },
  { grade: 3, cls: 'g3' },
];

function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildQueue(section: string, mode: string): Card[] {
  const pool = cards().filter((c) => section === 'all' || c.section === section);
  if (mode === 'all') return shuffle(pool);

  const now = Date.now();
  const due = pool
    .filter((c) => progress[c.id] && cardStatus(progress[c.id]) !== 'new' && isDue(progress[c.id], now))
    .sort((a, b) => progress[a.id].due_at.localeCompare(progress[b.id].due_at));
  const fresh = pool.filter((c) => cardStatus(progress[c.id]) === 'new');
  return [...due, ...fresh];
}

/** Дотик усередині елемента, що сам гортається вбік — тоді свайп належить йому, а не «назад» */
function inHorizontalScroll(target: EventTarget | null): boolean {
  for (let el = target as HTMLElement | null; el && el !== document.body; el = el.parentElement) {
    if (el.scrollWidth > el.clientWidth && /auto|scroll/.test(getComputedStyle(el).overflowX)) return true;
  }
  return false;
}

export default function Study() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const section = () => (typeof params.section === 'string' ? params.section : 'all');
  const mode = () => (params.mode === 'all' ? 'all' : 'due');

  // Черга фіксується на старті сесії, щоб оцінки не перебудовували її на льоту
  const [queue, setQueue] = createSignal<Card[]>(untrack(() => buildQueue(section(), mode())));
  const [index, setIndex] = createSignal(0);
  const [revealed, setRevealed] = createSignal(false);
  const [tally, setTally] = createSignal<Record<Grade, number>>({ 0: 0, 1: 0, 2: 0, 3: 0 });

  const current = createMemo(() => queue()[index()]);
  // Час на картку: від показу питання до оцінки (для статистики «Час навчання»)
  let shownAt = Date.now();
  createEffect(on(current, () => (shownAt = Date.now())));
  const finished = () => index() >= queue().length;
  const title = createMemo(() => {
    if (section() === 'all') return t('study.allSections');
    return sectionName(section(), cards().find((c) => c.section === section())?.section_title ?? '');
  });

  const grade = (g: Grade) => {
    const card = current();
    if (!card) return;
    gradeCard(user()!.uid, card, g, Date.now() - shownAt);
    setTally((t) => ({ ...t, [g]: t[g] + 1 }));
    if (g === 0) {
      // Невідома картка повертається через кілька інших у цій же сесії
      setQueue((q) => {
        const next = [...q];
        next.splice(Math.min(index() + 4, next.length), 0, card);
        return next;
      });
    }
    setRevealed(false);
    setIndex((i) => i + 1);
    window.scrollTo({ top: 0 });
  };

  const onKey = (e: KeyboardEvent) => {
    if (finished()) return;
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      if (!revealed()) setRevealed(true);
    } else if (revealed() && ['1', '2', '3', '4'].includes(e.key)) {
      grade((Number(e.key) - 1) as Grade);
    }
  };
  onMount(() => window.addEventListener('keydown', onKey));
  onCleanup(() => window.removeEventListener('keydown', onKey));

  // Свайп праворуч (телефон) — назад, як кнопка «Назад». Лише виразно горизонтальний рух
  // і не всередині того, що саме гортається вбік (широка таблиця у відповіді)
  let swipe: { x: number; y: number; t: number } | null = null;
  const onTouchStart = (e: TouchEvent) => {
    const touch = e.touches[0];
    swipe = e.touches.length === 1 && !inHorizontalScroll(e.target) ? { x: touch.clientX, y: touch.clientY, t: Date.now() } : null;
  };
  const onTouchEnd = (e: TouchEvent) => {
    if (!swipe) return;
    const touch = e.changedTouches[0];
    const dx = touch.clientX - swipe.x;
    const dy = Math.abs(touch.clientY - swipe.y);
    const fast = Date.now() - swipe.t < 800;
    swipe = null;
    if (fast && dx > 80 && dy < dx * 0.5) navigate('/');
  };

  return (
    <main class="page study" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <div class="study-top">
        <button class="btn ghost" onClick={() => navigate('/')}>
          {t('common.back')}
        </button>
        <div class="study-title">
          <span class="muted small">{mode() === 'all' ? t('study.modeAll') : t('study.modeDue')}</span>
          <strong>{title()}</strong>
        </div>
        <span class="counter">
          {Math.min(index() + 1, queue().length)}/{queue().length}
        </span>
      </div>
      <div class="meter thin">
        <div class="meter-fill strong" style={{ width: `${queue().length ? (index() / queue().length) * 100 : 0}%` }} />
      </div>

      {/* Ліворуч — картка з оцінками, праворуч — аналіз (на комп'ютері; оновлюється після кожної оцінки) */}
      <div class="study-body">
        <div class="study-stage">
          <Switch>
            <Match when={queue().length === 0}>
              <div class="empty">
                <h2>{t('study.emptyTitle')}</h2>
                <p class="muted">{t('study.emptyText')}</p>
                <button class="btn primary" onClick={() => navigate('/')}>
                  {t('common.home')}
                </button>
              </div>
            </Match>
            <Match when={finished()}>
              <div class="empty">
                <h2>{t('study.done')}</h2>
                <div class="summary">
                  <For each={GRADES}>
                    {(g) => (
                      <div class="summary-item">
                        <span class="stat-value">{tally()[g.grade]}</span>
                        <span class="stat-label">
                          <i class={`key ${g.cls}`} /> {t(`grade.${g.grade}`)}
                        </span>
                      </div>
                    )}
                  </For>
                </div>
                <div class="row center">
                  <button class="btn primary" onClick={() => navigate('/')}>
                    {t('common.home')}
                  </button>
                  <button class="btn" onClick={() => navigate('/stats')}>
                    {t('nav.stats')}
                  </button>
                </div>
              </div>
            </Match>
            <Match when={current()}>
              {(card) => (
                <>
                  <article class="flashcard" classList={{ revealed: revealed() }}>
                    <div class="flashcard-meta">
                      <span class="badge">{cardLabel(card())}</span>
                      <span class={`status ${cardStatus(progress[card().id])}`}>
                        {statusLabel(cardStatus(progress[card().id]))}
                      </span>
                    </div>
                    <h2 class="question">{card().question}</h2>
                    <Show
                      when={revealed()}
                      fallback={
                        <button class="btn primary block reveal" onClick={() => setRevealed(true)}>
                          {t('study.reveal')}
                        </button>
                      }
                    >
                      <hr />
                      <Markdown text={card().answer} />
                    </Show>
                  </article>

                  <Show when={revealed()}>
                    <div class="grades">
                      <For each={GRADES}>
                        {(g) => (
                          <button class={`grade ${g.cls}`} onClick={() => grade(g.grade)}>
                            <span>{t(`grade.${g.grade}`)}</span>
                            <small>{intervalLabel(progress[card().id], g.grade)}</small>
                          </button>
                        )}
                      </For>
                    </div>
                  </Show>
                </>
              )}
            </Match>
          </Switch>
        </div>
        <HomeAnalysis />
      </div>
    </main>
  );
}
