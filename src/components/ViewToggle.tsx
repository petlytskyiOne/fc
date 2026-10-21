import { createSignal } from 'solid-js';
import { t } from '../lib/i18n';

// Перемикач «Плитки / Список» (Бібліотека, Картки). Вибір запам'ятовується окремо для кожної сторінки на цьому пристрої.

export type ViewMode = 'list' | 'tiles';

export function createViewMode(key: string): [() => ViewMode, (v: ViewMode) => void] {
  const storageKey = `fc.view.${key}`;
  // За замовчуванням — плитки; список лише якщо його вибрали
  let initial: ViewMode = 'tiles';
  try {
    if (localStorage.getItem(storageKey) === 'list') initial = 'list';
  } catch {
    // без сховища — завжди плитки
  }
  const [view, setView] = createSignal<ViewMode>(initial);
  const save = (v: ViewMode) => {
    setView(v);
    try {
      localStorage.setItem(storageKey, v);
    } catch {
      // вибір діятиме до перезапуску
    }
  };
  return [view, save];
}

/** Компактний перемикач: лише значки, назви — у підказці */
export default function ViewToggle(props: { value: ViewMode; onChange: (v: ViewMode) => void }) {
  return (
    <div class="segmented compact" role="tablist" aria-label={t('decks.view')}>
      <button
        role="tab"
        aria-selected={props.value === 'tiles'}
        aria-label={t('decks.viewTiles')}
        title={t('decks.viewTiles')}
        classList={{ active: props.value === 'tiles' }}
        onClick={() => props.onChange('tiles')}
      >
        ▦
      </button>
      <button
        role="tab"
        aria-selected={props.value === 'list'}
        aria-label={t('decks.viewList')}
        title={t('decks.viewList')}
        classList={{ active: props.value === 'list' }}
        onClick={() => props.onChange('list')}
      >
        ☰
      </button>
    </div>
  );
}
