// Створює приклад колоди для заповнення: template/Моя колода/ і template/Моя колода.zip.
// Вміст береться з того ж коду, що й кнопка «Завантажити шаблон» у застосунку.
// Запуск: npm run template
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { templateEntries } from '../src/lib/deckFormat.ts';
import { createZip } from '../src/lib/zip.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'template');
rmSync(root, { recursive: true, force: true });

const entries = templateEntries();
for (const e of entries) {
  const path = resolve(root, e.path);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, e.content, 'utf8');
}
const folder = entries[0].path.split('/')[0];
writeFileSync(resolve(root, `${folder}.zip`), createZip(entries));
console.log(`Шаблон: ${root}`);
for (const e of entries) console.log('  ', e.path);

// Повний приклад: вбудована колода (src/data/cards.json) у тому самому форматі —
// так само, як її вивантажує експорт «Папка з розділами».
type Card = { id: string; section: string; section_title: string; question: string; answer: string };
const cards: Card[] = JSON.parse(readFileSync(resolve(root, '..', 'src', 'data', 'cards.json'), 'utf8'));
const deckRoot = 'Співбесіда НКЦПФР';
const sections = new Map<string, { title: string; cards: Card[] }>();
for (const c of cards) {
  if (!sections.has(c.section)) sections.set(c.section, { title: c.section_title, cards: [] });
  sections.get(c.section)!.cards.push(c);
}
const full = [
  {
    path: `${deckRoot}/deck.md`,
    content: `# ${deckRoot}\n\nauthor: Петлицький В.М.\ndescription: Питання та відповіді до співбесіди в НКЦПФР: ризики, внутрішній аудит, нагляд, комплаєнс.\n`,
  },
  ...[...sections].map(([code, s], i) => {
    const lines = [`# ${code}. ${s.title}`, ''];
    for (const c of s.cards) lines.push('---', '', `## ${c.question}`, '', c.answer, '');
    return { path: `${deckRoot}/${String(i + 1).padStart(2, '0')}-${s.title}.md`, content: lines.join('\n') };
  }),
];
for (const e of full) {
  const path = resolve(root, e.path);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, e.content, 'utf8');
}
writeFileSync(resolve(root, `${deckRoot}.zip`), createZip(full));
console.log(`\nПовний приклад (${cards.length} карток):`);
for (const e of full) console.log('  ', e.path);
