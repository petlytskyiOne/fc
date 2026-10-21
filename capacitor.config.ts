import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'ua.forum.flashcards',
  appName: 'Cards',
  webDir: 'dist',
  android: {
    // Supabase працює по https, змішаний контент не потрібен
    allowMixedContent: false,
  },
};

export default config;
