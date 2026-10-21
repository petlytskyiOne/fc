import { createMemo, createSignal, For, Show } from 'solid-js';
import { A, useSearchParams } from '@solidjs/router';
import Markdown from '../components/Markdown';
import { TopbarActions } from '../components/TopbarSlot';
import ViewToggle, { createViewMode } from '../components/ViewToggle';
import { lang, sectionBadge, t } from '../lib/i18n';
import { cardStatus, statusLabel } from '../lib/srs';
import { activeDeck, cardLabel, cards, progress, sectionName, sections } from '../lib/store';

export default function Browse() {
  const [params, setParams] = useSearchParams();
  // ?q=I.8 — перехід зі статистики: одразу знаходимо й розгортаємо картку
  const initialQuery = typeof params.q === 'string' ? params.q : '';
  const [query, setQuery] = createSignal(initialQuery);
  const [open, setOpen] = createSignal<string | null>(initialQuery || null);
  const [view, setView] = createViewMode('cards');

  const section = () => (typeof params.section === 'string' ? params.section : 'all');

  const filtered = createMemo(() => {
    const q = query().trim().toLowerCase();
    return cards().filter(
      (c) =>
        (section() === 'all' || c.section === section()) &&
        (!q || c.question.toLowerCase().includes(q) || c.answer.toLowerCase().includes(q) || c.id.toLowerCase() === q || cardLabel(c).toLowerCase() === q),
    );
  });

  /** Експорт і вигляд — маленькі значки; підписи в підказках */
  const tools = () => (
    <>
      <A class="btn ghost icon" href="/export" title={t('export.open')} aria-label={t('export.open')}>
        ↓
      </A>
      <ViewToggle value={view()} onChange={setView} />
    </>
  );

  return (
    <main class="page wide browse">
      {/* Шапка, пошук і розділи — на всю ширину в обох виглядах; список — від лівого краю, вужчий за плитки */}
      <header class="page-head">
        <h1>
          {t('browse.title')} <span class="counter">{filtered().length}</span>
        </h1>
        <div class="head-tools">{tools()}</div>
      </header>
      {/* на телефоні ті самі кнопки — у верхній панелі, навпроти логотипа */}
      <TopbarActions>{tools()}</TopbarActions>

      <Show when={lang() === 'en' && activeDeck().builtin}>
        <p class="muted small note">{t('browse.cardsNote')}</p>
      </Show>

      <input
        class="search"
        type="search"
        placeholder={t('browse.search')}
        value={query()}
        onInput={(e) => setQuery(e.currentTarget.value)}
      />

      <div class="chips">
        <button classList={{ chip: true, active: section() === 'all' }} onClick={() => setParams({ section: 'all' })}>
          {t('common.all')}
        </button>
        <For each={sections()}>
          {(s) => (
            <button
              classList={{ chip: true, active: section() === s.code }}
              onClick={() => setParams({ section: s.code })}
            >
              {s.code === '0' ? sectionBadge(s.code) : `${s.code}. ${sectionName(s.code, s.title)}`}
            </button>
          )}
        </For>
      </div>

      <ul class="card-list" classList={{ tiles: view() === 'tiles' }}>
        <For each={filtered()} fallback={<li class="muted">{t('browse.nothing')}</li>}>
          {(card) => (
            <li class="card-row" classList={{ open: open() === card.id }}>
              <button class="card-row-head" onClick={() => setOpen(open() === card.id ? null : card.id)}>
                <span class="badge">{cardLabel(card)}</span>
                <span class="card-row-q">{card.question}</span>
                <span
                  class={`dot ${cardStatus(progress[card.id])}`}
                  title={statusLabel(cardStatus(progress[card.id]))}
                />
              </button>
              <Show when={open() === card.id}>
                <div class="card-row-body">
                  <Markdown text={card.answer} />
                </div>
              </Show>
            </li>
          )}
        </For>
      </ul>
    </main>
  );
}
