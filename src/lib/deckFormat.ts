// Формат колоди (як книга в Shelf):
//
//   Моя колода/
//     deck.md              ← # Назва колоди / author: … / description: …  (book.md теж підходить)
//     01-Перший розділ.md  ← # Назва розділу, далі картки
//     02-Другий розділ.md
//
// У файлі розділу кожна картка починається заголовком «## Питання», а все до наступного «##» — відповідь.
// Порядок розділів — за номером на початку імені файлу. Код розділу (I, II, 1, 2…) — з рядка «code:»,
// з початку заголовка («# I. Назва») або з номера файлу.
// Файли README.md, *.txt і ті, що починаються з «_» або «.», ігноруються.

import type { ZipEntry } from './zip';

export interface ParsedCard {
  question: string;
  answer: string;
}

export interface ParsedSection {
  file: string;
  code: string;
  title: string;
  cards: ParsedCard[];
}

export interface ParseIssue {
  /** Ключ повідомлення в i18n (import.warn.*) */
  key: string;
  params: Record<string, string | number>;
}

export interface ParsedDeck {
  title: string;
  author: string;
  description: string;
  sections: ParsedSection[];
  warnings: ParseIssue[];
  cardCount: number;
}

export interface SourceFile {
  path: string;
  content: string;
}

const META_FILES = ['deck.md', 'book.md'];
const CODE_PREFIX = /^(0|[IVXLC]+|\d+)\.\s+(.+)$/;
// «I.5. », «12. », «1.2. » — номер картки з нашого експорту
const QUESTION_ID = /^(?:(?:0|[IVXLC]+)\.)?\d+(?:\.\d+)*[.)]\s+/;
const QUESTION_LABEL = /^(?:питання|question|q)\s*:\s*/i;
const ANSWER_LABEL = /^\**(?:відповідь|answer|a)\s*:\**\s*/i;

const basename = (path: string) => path.split('/').pop() ?? path;
const stripExt = (name: string) => name.replace(/\.md$/i, '');

function metaValue(content: string, keys: string[]): string {
  for (const key of keys) {
    const m = content.match(new RegExp(`^${key}\\s*:\\s*(.+)$`, 'mi'));
    if (m) return m[1].trim();
  }
  return '';
}

const firstHeading = (content: string) => content.match(/^#\s+(.+)$/m)?.[1].trim() ?? '';

function isIgnored(path: string): boolean {
  const name = basename(path);
  return (
    path.includes('__MACOSX/') ||
    !/\.md$/i.test(name) ||
    name.startsWith('_') ||
    name.startsWith('.') ||
    name.toLowerCase() === 'readme.md'
  );
}

/** Розбиває текст розділу на картки за заголовками «##» (ігноруючи «##» усередині блоків коду) */
function splitCards(content: string): { cards: ParsedCard[]; empty: string[] } {
  const cards: ParsedCard[] = [];
  const empty: string[] = [];
  let current: { question: string; lines: string[] } | null = null;
  let inFence = false;

  const flush = () => {
    if (!current) return;
    const lines = [...current.lines];
    // Службові рядки нашого експорту і роздільники не є частиною відповіді
    while (lines.length && (!lines[0].trim() || /^\*Мій статус:.*\*$/.test(lines[0].trim()) || lines[0].trim() === '---')) lines.shift();
    while (lines.length && (!lines[lines.length - 1].trim() || lines[lines.length - 1].trim() === '---')) lines.pop();
    if (lines.length) lines[0] = lines[0].replace(ANSWER_LABEL, '');
    const answer = lines.join('\n').trim();
    if (answer) cards.push({ question: current.question, answer });
    else empty.push(current.question);
    current = null;
  };

  for (const line of content.split(/\r?\n/)) {
    if (/^\s*(```|~~~)/.test(line)) inFence = !inFence;
    const m = !inFence && line.match(/^##\s+(.+?)\s*#*\s*$/);
    if (m && !line.startsWith('###')) {
      flush();
      const question = m[1].replace(QUESTION_ID, '').replace(QUESTION_LABEL, '').trim();
      current = { question, lines: [] };
    } else if (current) {
      current.lines.push(line);
    }
  }
  flush();
  return { cards, empty };
}

export function parseDeck(files: SourceFile[]): ParsedDeck {
  const warnings: ParseIssue[] = [];
  const warn = (key: string, params: Record<string, string | number> = {}) => warnings.push({ key, params });

  const meta = files.find((f) => META_FILES.includes(basename(f.path).toLowerCase()));
  const rootFolder = files[0]?.path.includes('/') ? files[0].path.split('/')[0] : '';
  const title = (meta && firstHeading(meta.content)) || rootFolder || '';
  if (!meta) warn('import.warn.noMeta');

  const sectionFiles = files
    .filter((f) => !isIgnored(f.path) && !META_FILES.includes(basename(f.path).toLowerCase()))
    .map((f) => ({ ...f, name: stripExt(basename(f.path)) }))
    .sort((a, b) => {
      const na = Number(a.name.match(/^(\d+)/)?.[1] ?? Infinity);
      const nb = Number(b.name.match(/^(\d+)/)?.[1] ?? Infinity);
      return na - nb || a.name.localeCompare(b.name, 'uk', { numeric: true });
    });

  // README.md — зміст із нашого експорту, його пропуск очікуваний, тож не згадуємо
  const ignored = files
    .filter((f) => isIgnored(f.path) && /\.md$/i.test(f.path) && basename(f.path).toLowerCase() !== 'readme.md')
    .map((f) => basename(f.path));
  if (ignored.length) warn('import.warn.ignored', { files: ignored.join(', ') });

  const usedCodes = new Set<string>();
  const sections: ParsedSection[] = [];

  sectionFiles.forEach((f, index) => {
    let heading = firstHeading(f.content);
    if (!heading) warn('import.warn.noTitle', { file: basename(f.path) });

    let code = metaValue(f.content, ['code', 'код']);
    const fromHeading = heading.match(CODE_PREFIX);
    if (fromHeading) {
      code ||= fromHeading[1];
      heading = fromHeading[2];
    }
    const fromName = f.name.match(/^(\d+)[-_.\s]*(.*)$/);
    const nameCode = f.name.match(CODE_PREFIX);
    code ||= nameCode?.[1] ?? (fromName ? String(Number(fromName[1])) : String(index + 1));
    const sectionTitle =
      heading || (nameCode?.[2] ?? fromName?.[2] ?? f.name).replace(/[-_]+/g, ' ').trim() || f.name;

    if (usedCodes.has(code)) {
      const replacement = String(index + 1);
      warn('import.warn.dupCode', { code, file: basename(f.path), replacement });
      code = usedCodes.has(replacement) ? `${code}-${index + 1}` : replacement;
    }
    usedCodes.add(code);

    const { cards, empty } = splitCards(f.content);
    for (const q of empty) warn('import.warn.emptyAnswer', { question: q, file: basename(f.path) });
    if (!cards.length) {
      warn('import.warn.noCards', { file: basename(f.path) });
      return;
    }
    sections.push({ file: basename(f.path), code, title: sectionTitle, cards });
  });

  return {
    title,
    author: meta ? metaValue(meta.content, ['author', 'автор']) : '',
    description: meta ? metaValue(meta.content, ['description', 'опис']) : '',
    sections,
    warnings,
    cardCount: sections.reduce((n, s) => n + s.cards.length, 0),
  };
}

// ---------------- Шаблон для заповнення ----------------

const TEMPLATE_ROOT = 'Моя колода';

const DECK_MD = `# Моя колода

author: Ваше ім'я
description: Короткий опис: для чого ця колода і що в ній.
`;

const SECTION_1 = `# I. Управління ризиками

Цей текст до першого питання — вступ до розділу. Він не стає карткою, його можна видалити.

---

## Що таке ризик-апетит?

Сукупна величина ризику, яку компанія **готова прийняти** для досягнення цілей.
Затверджує Наглядова рада в Декларації схильності до ризиків.

---

## Які основні методи реагування на ризик?

1. **Уникнути** — відмовитися від ризикової операції.
2. **Зменшити** — ліміти, диверсифікація, контролі.
3. **Передати** — страхування, аутсорсинг.
4. **Прийняти** — якщо ризик у межах ризик-апетиту.
`;

const SECTION_2 = `# II. Внутрішній аудит

---

## Кому підпорядковується внутрішній аудитор?

Наглядовій раді — функціонально й адміністративно.

> Порада: тут можна писати примітки в блоці цитати — вони виділяються кольором.

---

## Як часто аудитор звітує Наглядовій раді?

| Звіт | Строк |
|---|---|
| Звіт з питань ВА | не рідше 1 разу на півроку |
| Виконання річного плану | до кінця січня наступного року |
`;

const SECTION_3 = `# III. Новий розділ

Скопіюйте цей файл, щоб додати розділ. Номер на початку імені файлу задає порядок.

---

## Ваше питання?

Ваша відповідь. Можна кілька абзаців, списки, **жирний** текст, таблиці.

---

## Ще одне питання?

Відповідь.
`;

const INSTRUCTIONS = `ЯК ЗАПОВНЮВАТИ КОЛОДУ ДЛЯ CARDS
================================

1. deck.md — назва та опис колоди:
     # Назва колоди
     author: автор
     description: опис

2. Кожен розділ — окремий файл .md. Номер на початку імені задає порядок:
     01-Управління ризиками.md, 02-Внутрішній аудит.md, ...

3. Перший рядок файлу розділу — його назва:
     # I. Управління ризиками
   «I.» на початку стає кодом розділу (I.1, I.2…). Без коду номер береться з імені файлу.

4. Кожна картка:
     ## Питання?          ← рівно два знаки #
     Відповідь…           ← усе до наступного «##»
   У відповіді можна: абзаци, списки, **жирний**, таблиці, цитати (>), підзаголовки ### і нижче.
   Не використовуйте «##» усередині відповіді — це почне нову картку.
   Лінії «---» між картками необов'язкові, лише для зручності читання.

5. Імпорт у Cards: Профіль → Колоди → Імпорт. Виберіть ZIP-архів цієї папки, саму папку
   (на комп'ютері) або всі .md-файли. Перед збереженням буде показано, що розпізнано.

6. Щоб оновити колоду — відредагуйте файли та імпортуйте ще раз з тією самою назвою в deck.md:
   колода оновиться, прогрес по картках збережеться, якщо порядок питань не змінювався.

Файли README.md, *.txt і ті, що починаються з «_», програма ігнорує.
`;

export function templateEntries(): ZipEntry[] {
  return [
    { path: `${TEMPLATE_ROOT}/deck.md`, content: DECK_MD },
    { path: `${TEMPLATE_ROOT}/01-Управління ризиками.md`, content: SECTION_1 },
    { path: `${TEMPLATE_ROOT}/02-Внутрішній аудит.md`, content: SECTION_2 },
    { path: `${TEMPLATE_ROOT}/03-Новий розділ.md`, content: SECTION_3 },
    { path: `${TEMPLATE_ROOT}/ЯК ЗАПОВНЮВАТИ.txt`, content: INSTRUCTIONS },
  ];
}
