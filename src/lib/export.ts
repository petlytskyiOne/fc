// Експорт карток у файли: HTML для друку/PDF, Word, Markdown, CSV (Excel) і Anki.
// Вміст карток український, тому й документ експорту — українською.
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { cardStatus } from './srs';
import { createZip } from './zip';
import { deckSections, progress, type SectionInfo } from './store';
import type { Card, CardStatus, Deck, Progress } from '../types';

export type ExportFormat = 'folder' | 'pdf' | 'word' | 'markdown' | 'csv' | 'anki';

export interface ExportOptions {
  title: string;
  author: string;
  description: string;
  sections: SectionInfo[];
  progress: Record<string, Progress>;
  withProgress: boolean;
}

export interface ExportFile {
  name: string;
  mime: string;
  /** Текст або двійкові дані (ZIP) */
  content: string | Uint8Array;
}

/** Мітка картки без префікса імпортованої колоди */
const label = (c: Card) => c.id.split('~').pop() ?? c.id;

const today = () => new Date().toISOString().slice(0, 10);
const fileBase = () => `NKCPFR_cards_${today()}`;
const countCards = (o: ExportOptions) => o.sections.reduce((n, s) => n + s.cards.length, 0);
const sectionHeading = (s: SectionInfo) => (s.code === '0' ? s.title : `${s.code}. ${s.title}`);
// Документ експорту завжди українською, незалежно від мови інтерфейсу
const STATUS_UK: Record<CardStatus, string> = {
  new: 'Нова',
  learning: 'Вивчається',
  review: 'Повторення',
  mastered: 'Вивчена',
};
const status = (o: ExportOptions, c: Card) => STATUS_UK[cardStatus(o.progress[c.id])];

function markdown(o: ExportOptions): string {
  const lines: string[] = [
    `# ${o.title}`,
    '',
    `> Експортовано з Cards ${new Date().toLocaleDateString('uk-UA')} · карток: ${countCards(o)}`,
    '',
    '## Зміст',
    '',
    ...o.sections.map((s) => `- ${sectionHeading(s)} (${s.cards.length})`),
    '',
  ];
  for (const s of o.sections) {
    lines.push('---', '', `## ${sectionHeading(s)}`, '');
    for (const c of s.cards) {
      lines.push(`### ${label(c)}. ${c.question}`, '');
      if (o.withProgress) lines.push(`*Мій статус: ${status(o, c)}*`, '');
      lines.push(c.answer, '');
    }
  }
  return lines.join('\n');
}

/**
 * Ім'я файлу розділу як у Shelf: номер задає порядок («01-…»), без символів, заборонених у Windows/Android.
 * Код розділу записується в заголовок файлу («# I. Назва»), тож імпорт відновлює ті самі коди.
 */
const sectionFile = (s: SectionInfo, i: number) =>
  `${String(i + 1).padStart(2, '0')}-${s.title}`.replace(/[\\/:*?"<>|]/g, '-') + '.md';

/** Коренева папка ZIP — назва колоди, щоб експорти різних колод не плутались */
const folderRoot = (o: ExportOptions) => o.title.replace(/[\\/:*?"<>|]/g, '-').trim() || fileBase();

/** Папка у форматі колоди: deck.md + README.md зі змістом + окремий .md на кожен розділ, запаковані в ZIP */
function folder(o: ExportOptions): Uint8Array {
  const root = folderRoot(o);
  const date = new Date().toLocaleDateString('uk-UA');
  const deckMd = [`# ${o.title}`, '', `author: ${o.author}`, `description: ${o.description}`, ''].join('\n');
  const readme = [
    `# ${o.title}`,
    '',
    `> Експортовано з Cards ${date} · розділів: ${o.sections.length} · карток: ${countCards(o)}`,
    '',
    '## Розділи',
    '',
    ...o.sections.map((s, i) => `- [${sectionHeading(s)}](<${sectionFile(s, i)}>) — ${s.cards.length}`),
    '',
  ].join('\n');

  const files = o.sections.map((s, i) => {
    const lines = [
      `# ${s.code}. ${s.title}`,
      '',
      `> Розділ ${i + 1} з ${o.sections.length} · карток: ${s.cards.length} · експортовано ${date}`,
      '',
      '[← Зміст](README.md)',
      '',
    ];
    for (const c of s.cards) {
      lines.push('---', '', `## ${label(c)}. ${c.question}`, '');
      if (o.withProgress) lines.push(`*Мій статус: ${status(o, c)}*`, '');
      lines.push(c.answer, '');
    }
    return { path: `${root}/${sectionFile(s, i)}`, content: lines.join('\n') };
  });

  return createZip([{ path: `${root}/deck.md`, content: deckMd }, { path: `${root}/README.md`, content: readme }, ...files]);
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]!);

const renderMd = (md: string) => DOMPurify.sanitize(marked.parse(md, { async: false }) as string);

/** Самодостатній HTML: відкривається в будь-якому браузері, друкується в PDF, відкривається у Word */
function html(o: ExportOptions, forWord: boolean): string {
  const toc = o.sections
    .map((s) => `<li><a href="#s-${s.code}">${escapeHtml(sectionHeading(s))}</a> <span class="muted">(${s.cards.length})</span></li>`)
    .join('');
  const body = o.sections
    .map(
      (s) => `
<section class="section" id="s-${s.code}">
  <h2>${escapeHtml(sectionHeading(s))}</h2>
  ${s.cards
    .map(
      (c) => `
  <article class="card">
    <h3><span class="id">${escapeHtml(label(c))}</span> ${escapeHtml(c.question)}</h3>
    ${o.withProgress ? `<p class="status">Мій статус: ${escapeHtml(status(o, c))}</p>` : ''}
    <div class="answer">${renderMd(c.answer)}</div>
  </article>`,
    )
    .join('')}
</section>`,
    )
    .join('');

  const wordHead = forWord
    ? '<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View></w:WordDocument></xml><![endif]-->'
    : '';

  return `<!doctype html>
<html lang="uk"${forWord ? ' xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"' : ''}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(o.title)}</title>
${wordHead}
<style>
  @page { size: A4; margin: 18mm 16mm; }
  body { font-family: Calibri, 'Segoe UI', Arial, sans-serif; font-size: 11pt; line-height: 1.45; color: #111; max-width: 820px; margin: 0 auto; padding: 16px; }
  h1 { font-size: 20pt; margin: 0 0 4px; color: #1d3fa8; }
  h2 { font-size: 15pt; color: #1d3fa8; border-bottom: 2px solid #1d3fa8; padding-bottom: 4px; margin-top: 28px; }
  h3 { font-size: 12pt; margin: 18px 0 6px; }
  .id { display: inline-block; min-width: 3.2em; color: #1d3fa8; }
  .muted, .meta { color: #666; }
  .status { margin: 0 0 6px; font-size: 9.5pt; color: #555; font-style: italic; }
  .card { break-inside: avoid-page; page-break-inside: avoid; border-bottom: 1px solid #e3e6ee; padding-bottom: 8px; }
  .answer p, .answer ul, .answer ol { margin: 4px 0; }
  .answer ul, .answer ol { padding-left: 22px; }
  blockquote { margin: 6px 0; padding: 6px 10px; background: #fff7e0; border-left: 3px solid #e0a100; }
  table { border-collapse: collapse; margin: 6px 0; font-size: 10pt; }
  th, td { border: 1px solid #bbb; padding: 3px 6px; text-align: left; vertical-align: top; }
  th { background: #eef1f8; }
  .toc a { color: #1d3fa8; text-decoration: none; }
  @media print {
    body { max-width: none; padding: 0; }
    .section { page-break-before: always; break-before: page; }
    .toc a { color: #111; }
  }
</style>
</head>
<body>
<h1>${escapeHtml(o.title)}</h1>
<p class="meta">Експортовано з Cards ${new Date().toLocaleDateString('uk-UA')} · карток: ${countCards(o)}</p>
<h2>Зміст</h2>
<ol class="toc">${toc}</ol>
${body}
</body>
</html>`;
}

function csvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

/** CSV для Excel: UTF-8 з BOM, роздільник «;» (так Excel з українською локаллю відкриває без майстра імпорту) */
function csv(o: ExportOptions): string {
  const header = ['ID', 'Розділ', 'Питання', 'Відповідь', ...(o.withProgress ? ['Мій статус'] : [])];
  const rows = o.sections.flatMap((s) =>
    s.cards.map((c) => [label(c), sectionHeading(s), c.question, c.answer, ...(o.withProgress ? [status(o, c)] : [])]),
  );
  return '﻿' + [header, ...rows].map((r) => r.map(csvCell).join(';')).join('\r\n');
}

/** Текстовий файл для імпорту в Anki: питання ⇥ відповідь (HTML) ⇥ теги */
function anki(o: ExportOptions): string {
  const oneLine = (s: string) => s.replace(/\t/g, ' ').replace(/\r?\n/g, ' ');
  const lines = o.sections.flatMap((s) =>
    s.cards.map((c) => {
      const tag = `NKCPFR::${s.code === '0' ? 'Common' : s.code}`;
      return [oneLine(`${label(c)}. ${c.question}`), oneLine(renderMd(c.answer)), tag].join('\t');
    }),
  );
  return ['#separator:tab', '#html:true', '#tags column:3', ...lines].join('\n');
}

/** Уся колода → ZIP у тій самій структурі, що читає імпорт (Бібліотека, Імпорт / експорт) */
export function deckFolderExport(deck: Deck, withProgress: boolean): ExportFile {
  return buildExport('folder', {
    title: deck.title,
    author: deck.author,
    description: deck.description,
    sections: deckSections(deck),
    progress,
    withProgress,
  });
}

export function buildExport(format: ExportFormat, o: ExportOptions): ExportFile {
  switch (format) {
    case 'folder':
      return { name: `${folderRoot(o)}_${today()}.zip`, mime: 'application/zip', content: folder(o) };
    case 'pdf':
      return { name: `${fileBase()}.html`, mime: 'text/html', content: html(o, false) };
    case 'word':
      return { name: `${fileBase()}.doc`, mime: 'application/msword', content: '﻿' + html(o, true) };
    case 'markdown':
      return { name: `${fileBase()}.md`, mime: 'text/markdown', content: markdown(o) };
    case 'csv':
      return { name: `${fileBase()}.csv`, mime: 'text/csv', content: csv(o) };
    case 'anki':
      return { name: `${fileBase()}_anki.txt`, mime: 'text/plain', content: anki(o) };
  }
}
