import { createMemo, createSignal, For, Show } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { useAuth } from '../lib/auth';
import { parseDeck, templateEntries, type ParsedDeck, type SourceFile } from '../lib/deckFormat';
import { deckFolderExport } from '../lib/export';
import { isNative, saveFile } from '../lib/files';
import { countOf, t, type I18nKey } from '../lib/i18n';
import { readZip } from '../lib/unzip';
import { createZip } from '../lib/zip';
import { activeDeck, findDeckByTitle, saveDeck, setActiveDeck } from '../lib/store';

// Імпорт і експорт колоди — окрема сторінка, відкривається з «Бібліотеки» (кнопка вгорі)

type Phase = 'idle' | 'reading' | 'preview' | 'saving';

const isText = (path: string) => /\.(md|txt)$/i.test(path);

/** Рекурсивно читає папку, перетягнуту у вікно (File System Entries API) */
async function readDroppedEntry(entry: FileSystemEntry, prefix = ''): Promise<SourceFile[]> {
  if (entry.isFile) {
    const file = await new Promise<File>((res, rej) => (entry as FileSystemFileEntry).file(res, rej));
    return isText(file.name) ? [{ path: prefix + file.name, content: await file.text() }] : [];
  }
  const reader = (entry as FileSystemDirectoryEntry).createReader();
  const children: FileSystemEntry[] = [];
  // readEntries віддає записи порціями — читаємо, доки не прийде порожній список
  for (;;) {
    const batch = await new Promise<FileSystemEntry[]>((res, rej) => reader.readEntries(res, rej));
    if (!batch.length) break;
    children.push(...batch);
  }
  const nested = await Promise.all(children.map((c) => readDroppedEntry(c, `${prefix}${entry.name}/`)));
  return nested.flat();
}

export default function ImportExport() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [phase, setPhase] = createSignal<Phase>('idle');
  const [parsed, setParsed] = createSignal<ParsedDeck | null>(null);
  const [title, setTitle] = createSignal('');
  const [message, setMessage] = createSignal<{ ok: boolean; text: string } | null>(null);
  const [dragging, setDragging] = createSignal(false);
  const [exporting, setExporting] = createSignal(false);
  const [withProgress, setWithProgress] = createSignal(false);

  const existing = createMemo(() => (title().trim() ? findDeckByTitle(title()) : undefined));

  const fail = (text: string) => {
    setPhase('idle');
    setMessage({ ok: false, text });
  };

  async function handleSources(load: () => Promise<SourceFile[]>) {
    setMessage(null);
    setPhase('reading');
    try {
      const files = await load();
      if (!files.some((f) => /\.md$/i.test(f.path))) return fail(t('import.noMd'));
      const result = parseDeck(files);
      if (!result.cardCount) return fail(t('import.noCards'));
      setParsed(result);
      setTitle(result.title || t('import.untitled'));
      setPhase('preview');
    } catch (error) {
      const msg = (error as Error).message;
      fail(msg === 'not a zip' ? t('import.notZip') : t('import.failed', { msg }));
    }
  }

  const fromZip = (file: File) => handleSources(() => readZip(file, isText));

  const fromFiles = (list: FileList) =>
    handleSources(async () =>
      Promise.all(
        [...list]
          .filter((f) => isText(f.name))
          .map(async (f) => ({ path: f.webkitRelativePath || f.name, content: await f.text() })),
      ),
    );

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const items = [...(e.dataTransfer?.items ?? [])];
    const zip = [...(e.dataTransfer?.files ?? [])].find((f) => /\.zip$/i.test(f.name));
    if (zip) return void fromZip(zip);
    const entries = items.map((i) => i.webkitGetAsEntry?.()).filter((x): x is FileSystemEntry => !!x);
    void handleSources(async () => (await Promise.all(entries.map((en) => readDroppedEntry(en)))).flat());
  };

  async function save() {
    const p = parsed();
    if (!p) return;
    setPhase('saving');
    try {
      const finalTitle = title().trim() || t('import.untitled');
      const id = await saveDeck(user()!.uid, { ...p, title: finalTitle }, existing()?.id);
      setActiveDeck(id);
      setParsed(null);
      setPhase('idle');
      setMessage({ ok: true, text: t('import.done', { title: finalTitle, cards: countOf(p.cardCount, 'cards') }) });
    } catch (error) {
      const msg = (error as Error).message;
      setPhase('preview');
      setMessage({ ok: false, text: msg === 'deck_too_big' ? t('import.tooBig') : t('import.failed', { msg }) });
    }
  }

  async function exportActive() {
    setExporting(true);
    setMessage(null);
    try {
      const file = deckFolderExport(activeDeck(), withProgress());
      await saveFile(file);
      setMessage({ ok: true, text: t(isNative() ? 'export.shared' : 'export.saved', { name: file.name }) });
    } catch (error) {
      // Користувач закрив меню «Поділитися» — це не помилка
      if (!/cancel/i.test((error as Error).message)) {
        setMessage({ ok: false, text: t('export.failed', { msg: (error as Error).message }) });
      }
    } finally {
      setExporting(false);
    }
  }

  const downloadTemplate = () =>
    saveFile({ name: 'Cards_шаблон_колоди.zip', mime: 'application/zip', content: createZip(templateEntries()) });

  // Після читання очищаємо поле, щоб той самий (виправлений) файл можна було вибрати повторно
  const takeFiles = (input: HTMLInputElement, use: (files: FileList) => unknown) => {
    const files = input.files;
    if (files?.length) {
      const copy = new DataTransfer();
      for (const f of files) copy.items.add(f);
      void use(copy.files);
    }
    input.value = '';
  };

  // webkitdirectory немає в типах JSX — ставимо атрибут вручну
  const folderInput = (el: HTMLInputElement) => el.setAttribute('webkitdirectory', '');

  return (
    <main class="page">
      <div class="study-top">
        <button class="btn ghost" onClick={() => navigate('/decks')}>
          {t('common.back')}
        </button>
        <div class="study-title">
          <strong>{t('import.title')}</strong>
        </div>
        <span />
      </div>

      <section class="panel io-panel">
        <p class="muted small">{t('import.intro')}</p>

        <Show when={phase() !== 'preview' && phase() !== 'saving'}>
          <div
            class="drop-zone"
            classList={{ dragging: dragging(), busy: phase() === 'reading' }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
          >
            <Show when={phase() === 'reading'} fallback={<span>⇪ {t('import.drop')}</span>}>
              <span>{t('import.reading')}</span>
            </Show>
          </div>

          <div class="import-methods">
            <label class="btn">
              🗜️ {t('import.zip')}
              <input
                type="file"
                accept=".zip,application/zip"
                hidden
                onChange={(e) => takeFiles(e.currentTarget, (files) => fromZip(files[0]))}
              />
            </label>
            <Show when={!isNative()}>
              <label class="btn">
                📁 {t('import.folder')}
                <input type="file" multiple hidden ref={folderInput} onChange={(e) => takeFiles(e.currentTarget, fromFiles)} />
              </label>
            </Show>
            <label class="btn">
              📄 {t('import.files')}
              <input
                type="file"
                multiple
                accept=".md,.txt,text/markdown,text/plain"
                hidden
                onChange={(e) => takeFiles(e.currentTarget, fromFiles)}
              />
            </label>
          </div>

          <button class="link small" onClick={() => void downloadTemplate()}>
            ↓ {t('import.template')}
          </button>
          <p class="muted small">{t('import.templateHint')}</p>

          <h3>{t('export.deckTitle')}</h3>
          <p class="muted small">{t('export.deckHint')}</p>
          <div class="import-methods">
            <button class="btn" disabled={exporting()} onClick={() => void exportActive()}>
              🗂️ {exporting() ? '…' : t('export.deckButton', { title: activeDeck().title })}
            </button>
          </div>
          <label class="check option">
            <input type="checkbox" checked={withProgress()} onChange={(e) => setWithProgress(e.currentTarget.checked)} />
            <span class="check-title small">{t('export.withProgressShort')}</span>
          </label>
        </Show>

        <Show when={(phase() === 'preview' || phase() === 'saving') && parsed()}>
          {(p) => (
            <div class="import-preview">
              <h3>{t('import.preview')}</h3>
              <label class="field">
                <span class="muted small">{t('import.deckTitle')}</span>
                <input class="search" value={title()} onInput={(e) => setTitle(e.currentTarget.value)} />
              </label>
              <Show when={existing()}>
                <p class="alert info small">{t('import.updateHint')}</p>
              </Show>

              <h4>{t('import.sections')}</h4>
              <ul class="check-list">
                <For each={p().sections}>
                  {(s) => (
                    <li class="check">
                      <span class="badge">{s.code}</span>
                      <span class="check-title">
                        {s.title}
                        <span class="muted small"> · {s.file}</span>
                      </span>
                      <span class="muted small">{s.cards.length}</span>
                    </li>
                  )}
                </For>
              </ul>

              <Show when={p().warnings.length}>
                <h4>{t('import.warnings')}</h4>
                <ul class="warnings">
                  <For each={p().warnings}>{(w) => <li>{t(w.key as I18nKey, w.params)}</li>}</For>
                </ul>
              </Show>

              <div class="row">
                <button class="btn primary" disabled={phase() === 'saving'} onClick={() => void save()}>
                  {phase() === 'saving'
                    ? t('import.saving')
                    : existing()
                      ? t('import.update', { title: existing()!.title })
                      : t('import.save', { cards: countOf(p().cardCount, 'cards') })}
                </button>
                <button
                  class="btn ghost"
                  disabled={phase() === 'saving'}
                  onClick={() => {
                    setParsed(null);
                    setPhase('idle');
                  }}
                >
                  {t('import.cancel')}
                </button>
              </div>
            </div>
          )}
        </Show>

        <Show when={message()}>
          <p class={`alert ${message()!.ok ? 'info' : 'error'}`} role="status">
            {message()!.text}
          </p>
        </Show>
      </section>
    </main>
  );
}
