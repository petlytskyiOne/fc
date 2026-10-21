import { createSignal, For, Show } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { useAuth } from '../lib/auth';
import { TopbarActions } from '../components/TopbarSlot';
import ViewToggle, { createViewMode } from '../components/ViewToggle';
import { countOf, locale, t } from '../lib/i18n';
import { deleteDeck, restoreDeck, trash } from '../lib/store';
import type { Deck } from '../types';

// Кошик колод — окрема сторінка, відкривається з «Бібліотеки» (значок 🗑 угорі).
// Колоду можна відновити разом із прогресом або видалити назавжди (тоді стирається й прогрес).
export default function Trash() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [message, setMessage] = createSignal<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = createSignal(false);
  // той самий вигляд, що й у бібліотеці
  const [view, setView] = createViewMode('library');

  async function action(run: () => Promise<unknown>, done?: string) {
    setBusy(true);
    setMessage(null);
    try {
      await run();
      if (done) setMessage({ ok: true, text: done });
    } catch (error) {
      setMessage({ ok: false, text: t('decks.actionFailed', { msg: (error as Error).message }) });
    } finally {
      setBusy(false);
    }
  }

  const restore = (d: Deck) => action(() => restoreDeck(user()!.uid, d.id), t('decks.restored', { title: d.title }));

  function removeForever(d: Deck) {
    if (!confirm(t('decks.deleteConfirm', { title: d.title }))) return;
    void action(() => deleteDeck(user()!.uid, d.id));
  }

  function emptyTrash() {
    const list = trash();
    if (!confirm(t('decks.emptyTrashConfirm', { n: list.length }))) return;
    void action(async () => {
      for (const d of list) await deleteDeck(user()!.uid, d.id);
    });
  }

  const deletedOn = (d: Deck) => new Date(d.deletedAt!).toLocaleDateString(locale());

  return (
    <main class="page wide">
      <div class="study-top">
        <button class="btn ghost" onClick={() => navigate('/decks')}>
          {t('common.back')}
        </button>
        <div class="study-title">
          <strong>🗑 {t('decks.trashTitle', { n: trash().length })}</strong>
        </div>
        <div class="head-tools">
          <ViewToggle value={view()} onChange={setView} />
        </div>
      </div>
      <TopbarActions>
        <ViewToggle value={view()} onChange={setView} />
      </TopbarActions>

      <div class="trash-head">
        <p class="muted small">{t('decks.trashHint')}</p>
        <Show when={trash().length}>
          <button class="link small danger" disabled={busy()} onClick={emptyTrash}>
            {t('decks.emptyTrash')}
          </button>
        </Show>
      </div>

      <Show when={message()}>
        <p class={`alert library-message ${message()!.ok ? 'info' : 'error'}`} role="status">
          {message()!.text}
        </p>
      </Show>

      <div class="library-main" classList={{ tiles: view() === 'tiles' }}>
        <ul class="deck-list">
          <For each={trash()} fallback={<li class="muted">{t('decks.trashEmpty')}</li>}>
            {(d) => (
              <li class="deck trashed">
                <div class="deck-main">
                  <strong>{d.title}</strong>
                  <span class="muted small">
                    {t('decks.meta', { cards: countOf(d.cards.length, 'cards'), sections: d.sections.length })}
                  </span>
                  <span class="muted small">{t('decks.deletedOn', { date: deletedOn(d) })}</span>
                </div>
                <div class="deck-actions">
                  <button class="btn" disabled={busy()} onClick={() => void restore(d)}>
                    ↺ {t('decks.restore')}
                  </button>
                  <button
                    class="btn ghost icon danger"
                    disabled={busy()}
                    onClick={() => removeForever(d)}
                    title={t('decks.deleteForever')}
                    aria-label={t('decks.deleteForever')}
                  >
                    ✕
                  </button>
                </div>
              </li>
            )}
          </For>
        </ul>
      </div>
    </main>
  );
}
