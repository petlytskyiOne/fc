import { For } from 'solid-js';
import { lang, LANGS, setLang, t } from '../lib/i18n';

export default function LangSwitch(props: { class?: string }) {
  return (
    <div class={`segmented ${props.class ?? ''}`} role="radiogroup" aria-label={t('lang.label')}>
      <For each={LANGS}>
        {(l) => (
          <button
            role="radio"
            aria-checked={lang() === l.code}
            classList={{ active: lang() === l.code }}
            onClick={() => setLang(l.code)}
          >
            {l.label}
          </button>
        )}
      </For>
    </div>
  );
}
