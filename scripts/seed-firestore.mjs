// Заливає src/data/cards.json у колекцію nkcpfr_cards через Firebase Admin SDK
// і видаляє картки, яких більше немає у файлі 04. Інших колекцій не торкається.
// Потрібен ключ сервісного акаунта: GOOGLE_APPLICATION_CREDENTIALS у .env.
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const COLLECTION = 'nkcpfr_cards';

// Мінімальне читання .env без додаткових залежностей
const envPath = resolve(root, '.env');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const credentials = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!credentials || !existsSync(resolve(root, credentials))) {
  console.error('Не знайдено ключ сервісного акаунта. Вкажіть GOOGLE_APPLICATION_CREDENTIALS у .env (див. README).');
  process.exit(1);
}
process.env.GOOGLE_APPLICATION_CREDENTIALS = resolve(root, credentials);

const projectId = process.env.VITE_FIREBASE_PROJECT_ID;
initializeApp({ credential: applicationDefault(), projectId });
const db = getFirestore();

const cards = JSON.parse(readFileSync(resolve(root, 'src', 'data', 'cards.json'), 'utf8'));
const ids = new Set(cards.map((c) => c.id));

const batch = db.batch();
for (const card of cards) {
  batch.set(db.collection(COLLECTION).doc(card.id), card);
}
const existing = await db.collection(COLLECTION).listDocuments();
const stale = existing.filter((ref) => !ids.has(ref.id));
stale.forEach((ref) => batch.delete(ref));
await batch.commit();

console.log(`Проєкт ${projectId}: записано ${cards.length} карток у ${COLLECTION}, видалено застарілих: ${stale.length}.`);
