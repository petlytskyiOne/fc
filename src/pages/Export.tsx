import { createMemo, createSignal, For, Show } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { buildExport, type ExportFormat } from '../lib/export';
import { isNative, printHtml, saveFile } from '../lib/files';
import { countOf, t, type I18nKey } from '../lib/i18n';
import { activeDeck, progress, sectionName, sections } from '../lib/store';

const FORMATS: { id: ExportFormat; icon: string; ext: string }[] = [
  { id: 'folder', icon: '🗂️', ext: '.zip' },
  { id: 'pdf', icon: '🖨️', ext: 'PDF' },
  { id: 'word', icon: '📝', ext: '.doc' },
  { id: 'markdown', icon: '📄', ext: '.md' },
  { id: 'csv', icon: '📊', ext: '.csv' },
  { id: 'anki', icon: '🧠', ext: '.txt' },
];

export default function Export() {
  const navigate = useNavigate();
  const [selected, setSelected] = createSignal<Set<string>>(new Set(sections().map((s) => s.code)));
  const [withProgress, setWithProgress] = createSignal(false);
  const [busy, setBusy] = createSignal<ExportFormat | null>(null);
  const [message, setMessage] = createSignal<{ ok: boolean; text: string } | null>(null);

  const chosen = createMemo(() => sections().filter((s) => selected().has(s.code)));
  const total = () => chosen().reduce((n, s) => n + s.cards.length, 0);
  const allSelected = () => selected().size === sections().length;

  const toggle = (code: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });

  const toggleAll = () => setSelected(allSelected() ? new Set<string>() : new Set(sections().map((s) => s.code)));

  const run = async (format: ExportFormat) => {
    setBusy(format);
    setMessage(null);
    try {
      const deck = activeDeck();
      const file = buildExport(format, {
        title: deck.title,
        author: deck.author,
        description: deck.description,
        sections: chosen(),
        progress,
        withProgress: withProgress(),
      });
      if (format === 'pdf' && !isNative()) {
        await printHtml(file.content as string);
        setMessage({ ok: true, text: t('export.printed') });
      } else {
        await saveFile(file);
        setMessage({ ok: true, text: t(isNative() ? 'export.shared' : 'export.saved', { name: file.name }) });
      }
    } catch (error) {
      // Користувач закрив меню «Поділитися» — це не помилка
      if (!/cancel/i.test((error as Error).message)) {
        setMessage({ ok: false, text: t('export.failed', { msg: (error as Error).message }) });
      }
    } finally {
      setBusy(null);
    }
  };

  return (
    <main class="page">
      <div class="study-top">
        <button class="btn ghost" onClick={() => navigate(-1)}>
          {t('common.back')}
        </button>
        <div class="study-title">
          <strong>{t('export.title')}</strong>
        </div>
        <span />
      </div>

      <p class="muted small">{t('export.intro')}</p>

      <section class="panel">
        <div class="panel-head">
          <h2>{t('export.sections')}</h2>
          <button class="link small" onClick={toggleAll}>
            {allSelected() ? t('export.none') : t('export.all')}
          </button>
        </div>
        <ul class="check-list">
          <For each={sections()}>
            {(s) => (
              <li>
                <label class="check">
                  <input type="checkbox" checked={selected().has(s.code)} onChange={() => toggle(s.code)} />
                  <span class="badge">{s.code === '0' ? '★' : s.code}</span>
                  <span class="check-title">{sectionName(s.code, s.title)}</span>
                  <span class="muted small">{s.cards.length}</span>
                </label>
              </li>
            )}
          </For>
        </ul>
        <label class="check option">
          <input type="checkbox" checked={withProgress()} onChange={(e) => setWithProgress(e.currentTarget.checked)} />
          <span class="check-title">{t('export.withProgress')}</span>
        </label>
      </section>

      <h2 class="section-heading">{t('export.format', { cards: countOf(total(), 'cards') })}</h2>
      <div class="formats">
        <For each={FORMATS}>
          {(f) => (
            <button class="format" disabled={total() === 0 || busy() !== null} onClick={() => run(f.id)}>
              <span class="format-icon" aria-hidden="true">
                {f.icon}
              </span>
              <span class="format-text">
                <strong>
                  {t(`export.${f.id}.name` as I18nKey)} <span class="muted small">{f.ext}</span>
                </strong>
                <span class="muted small">
                  {t((f.id === 'pdf' && isNative() ? 'export.pdf.descNative' : `export.${f.id}.desc`) as I18nKey)}
                </span>
              </span>
              <span class="format-go" aria-hidden="true">
                {busy() === f.id ? '…' : '↓'}
              </span>
            </button>
          )}
        </For>
      </div>

      <Show when={message()}>
        <p class={`alert ${message()!.ok ? 'info' : 'error'}`} role="status">
          {message()!.text}
        </p>
      </Show>
      <p class="muted small">{t('export.langNote')}</p>
    </main>
  );
}
