import { createSignal, For, Show } from 'solid-js';
import { A } from '@solidjs/router';
import { useAuth } from '../lib/auth';
import { TopbarActions } from '../components/TopbarSlot';
import ViewToggle, { createViewMode } from '../components/ViewToggle';
import { deckFolderExport } from '../lib/export';
import { isNative, saveFile } from '../lib/files';
import { countOf, t } from '../lib/i18n';
import { activeDeckId, bringBackBuiltin, builtinRemoved, decks, setActiveDeck, trash, trashDeck } from '../lib/store';
import type { Deck } from '../types';

export default function Decks() {
  const { user } = useAuth();
  const [message, setMessage] = createSignal<{ ok: boolean; text: string } | null>(null);
  const [exporting, setExporting] = createSignal<string | null>(null);
  const [view, setView] = createViewMode('library');
  const [trashBusy, setTrashBusy] = createSignal(false);

  /** Дії бібліотеки й кошика: одна за раз, результат — у повідомлення під шапкою */
  async function libraryAction(run: () => Promise<unknown>, done?: string) {
    setTrashBusy(true);
    setMessage(null);
    try {
      await run();
      if (done) setMessage({ ok: true, text: done });
    } catch (error) {
      setMessage({ ok: false, text: t('decks.actionFailed', { msg: (error as Error).message }) });
    } finally {
      setTrashBusy(false);
    }
  }

  const toTrash = (d: Deck) =>
    libraryAction(() => trashDeck(user()!.uid, d.id), t('decks.trashed', { title: d.title }));

  /** Колода → ZIP у тій самій структурі, що читає імпорт */
  async function exportDeck(deck: Deck) {
    setExporting(deck.id);
    setMessage(null);
    try {
      const file = deckFolderExport(deck, false);
      await saveFile(file);
      setMessage({ ok: true, text: t(isNative() ? 'export.shared' : 'export.saved', { name: file.name }) });
    } catch (error) {
      // Користувач закрив меню «Поділитися» — це не помилка
      if (!/cancel/i.test((error as Error).message)) {
        setMessage({ ok: false, text: t('export.failed', { msg: (error as Error).message }) });
      }
    } finally {
      setExporting(null);
    }
  }

  /** Кошик, імпорт / експорт і вигляд — маленькі значки; підписи в підказках */
  const tools = () => (
    <>
      <A
        href="/decks/trash"
        class="btn ghost icon trash-link"
        title={t('decks.trashTitle', { n: trash().length })}
        aria-label={t('decks.trashTitle', { n: trash().length })}
      >
        🗑
        <Show when={trash().length}>
          <span class="icon-badge">{trash().length}</span>
        </Show>
      </A>
      <A href="/decks/io" class="btn ghost icon" title={t('decks.io')} aria-label={t('decks.io')}>
        ⇅
      </A>
      <ViewToggle value={view()} onChange={setView} />
    </>
  );

  return (
    <main class="page wide">
      {/* Окремий розділ меню — заголовок як у «Статистиці»; імпорт і експорт — окремою сторінкою за кнопкою */}
      <header class="page-head">
        <h1>{t('decks.title')}</h1>
        <div class="head-tools">{tools()}</div>
      </header>
      {/* на телефоні ті самі кнопки — у верхній панелі, навпроти логотипа */}
      <TopbarActions>{tools()}</TopbarActions>

      <Show when={message()}>
        <p class={`alert library-message ${message()!.ok ? 'info' : 'error'}`} role="status">
          {message()!.text}
        </p>
      </Show>

      <div class="library-main" classList={{ tiles: view() === 'tiles' }}>
        <ul class="deck-list">
          <For each={decks()}>
            {(d) => (
              <li class="deck" classList={{ active: activeDeckId() === d.id }}>
                {/* Уся колода — кнопка вибору; активна позначена рамкою й міткою */}
                <button
                  class="deck-main deck-select"
                  onClick={() => setActiveDeck(d.id)}
                  aria-pressed={activeDeckId() === d.id}
                  title={activeDeckId() === d.id ? t('decks.active') : t('decks.activate')}
                >
                  <strong>{d.title}</strong>
                  <span class="muted small">
                    {d.builtin ? `${t('decks.builtin')} · ` : ''}
                    {t('decks.meta', { cards: countOf(d.cards.length, 'cards'), sections: d.sections.length })}
                  </span>
                  <Show when={d.description}>
                    <span class="muted small deck-desc">{d.description}</span>
                  </Show>
                </button>
                <div class="deck-actions">
                  <Show when={activeDeckId() === d.id}>
                    <span class="deck-active">● {t('decks.active')}</span>
                  </Show>
                  <button
                    class="btn ghost icon"
                    disabled={exporting() !== null}
                    onClick={() => void exportDeck(d)}
                    title={t('decks.export')}
                    aria-label={t('decks.export')}
                  >
                    {exporting() === d.id ? '…' : '↓'}
                  </button>
                  {/* останню колоду в кошик не прибрати — бібліотека не буває порожньою */}
                  <Show when={decks().length > 1}>
                    <button
                      class="btn ghost icon danger"
                      disabled={trashBusy()}
                      onClick={() => void toTrash(d)}
                      title={t('decks.trash')}
                      aria-label={t('decks.trash')}
                    >
                      🗑
                    </button>
                  </Show>
                </div>
              </li>
            )}
          </For>
        </ul>

        <Show when={builtinRemoved()}>
          <button
            class="link small"
            disabled={trashBusy()}
            onClick={() => void libraryAction(() => bringBackBuiltin(user()!.uid), t('decks.builtinBack'))}
          >
            ↺ {t('decks.bringBackBuiltin', { title: t('decks.builtinTitle') })}
          </button>
        </Show>
      </div>
    </main>
  );
}
