// Генерує src/data/cards.json з "04. Відповіді на перелік питань НКЦПФР (Question.pdf).md".
// Файл вбудовується в застосунок як офлайн-резерв і заливається у Firestore через npm run seed.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = process.env.CARDS_SOURCE
  ?? resolve(root, '..', 'Question', '04. Відповіді на перелік питань НКЦПФР (Question.pdf).md');

const SECTION_RE = /^## (0|I|II|III|IV)\. (.+)$/;
const QUESTION_RE = /^\*\*(\d+(?:\.\d+)?)(?:–\d+(?:\.\d+)?)?\.\s*(.*?)\*\*\s*(.*)$/;
const REF_RE = /^→ див\. ((?:0|I|II|III|IV)\.\d+(?:\.\d+)?)\.?\s*$/;

const jsonPath = resolve(root, 'src', 'data', 'cards.json');

// Без вихідного .md залишаємо вже згенерований cards.json, щоб dev/build не падали
if (!existsSync(source)) {
  if (existsSync(jsonPath)) {
    console.warn(`Не знайдено ${source} — використовую наявний src/data/cards.json.`);
    process.exit(0);
  }
  console.error(`Не знайдено ${source}, і немає src/data/cards.json. Вкажіть шлях через CARDS_SOURCE.`);
  process.exit(1);
}

const lines = readFileSync(source, 'utf8').split(/\r?\n/);
const cards = [];
let section = null;
let current = null;

const finish = () => {
  if (current) {
    current.answer = current.lines.join('\n').trim();
    delete current.lines;
    cards.push(current);
  }
  current = null;
};

for (const line of lines) {
  if (line.startsWith('## ')) {
    finish();
    const m = line.match(SECTION_RE);
    section = m ? { code: m[1], title: m[2].replace(/\s*\(.*\)$/, '') } : null;
    continue;
  }
  if (!section) continue;
  if (line.trim() === '---') {
    finish();
    continue;
  }
  const q = line.match(QUESTION_RE);
  if (q) {
    finish();
    const [, num, question, rest] = q;
    // "**1–5.** → див. 0.1–0.5." — посилання на спільний блок, окремої картки немає
    if (!question.trim()) continue;
    const id = section.code === '0' ? num : `${section.code}.${num}`;
    current = {
      id,
      section: section.code,
      section_title: section.title,
      num,
      position: 0,
      question: question.trim(),
      lines: rest.trim() ? [rest.trim()] : [],
    };
    continue;
  }
  if (current) current.lines.push(line);
}
finish();

// "→ див. III.27." підставляємо відповідь, на яку посилається картка
const byId = new Map(cards.map((c) => [c.id, c]));
for (const card of cards) {
  const [first, ...restLines] = card.answer.split('\n');
  const ref = first.trim().match(REF_RE);
  const target = ref && byId.get(ref[1]);
  if (target) {
    const extra = restLines.join('\n').trim();
    card.answer = `*Див. також ${target.id}.*\n\n${target.answer}${extra ? `\n\n${extra}` : ''}`;
  }
}
cards.forEach((c, i) => (c.position = i + 1));

mkdirSync(dirname(jsonPath), { recursive: true });
writeFileSync(jsonPath, JSON.stringify(cards, null, 2) + '\n', 'utf8');

const perSection = cards.reduce((acc, c) => ((acc[c.section] = (acc[c.section] ?? 0) + 1), acc), {});
console.log(`Карток: ${cards.length}`, perSection);
