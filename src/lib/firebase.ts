import { initializeApp } from 'firebase/app';
import { browserLocalPersistence, indexedDBLocalPersistence, initializeAuth } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentSingleTabManager } from 'firebase/firestore';

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
};

export const firebaseConfigured = Boolean(config.apiKey && config.authDomain && config.projectId && config.appId);

// Колекції з префіксом, щоб не перетинатися з іншими застосунками в тому ж проєкті
export const CARDS_COLLECTION = 'nkcpfr_cards';
export const USERS_COLLECTION = 'nkcpfr_users';

const app = initializeApp(firebaseConfigured ? config : { apiKey: 'not-configured', projectId: 'not-configured', appId: 'not-configured' });

// initializeAuth замість getAuth: у WebView Capacitor getAuth чекає на popup/redirect-резолвер і може зависнути
export const auth = initializeAuth(app, {
  persistence: [indexedDBLocalPersistence, browserLocalPersistence],
});

// Локальний кеш Firestore: картки й прогрес доступні офлайн, записи відправляються, коли з'явиться мережа
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentSingleTabManager(undefined) }),
});
