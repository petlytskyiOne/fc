import { defineConfig } from 'vite';
import solid from 'vite-plugin-solid';

export default defineConfig({
  plugins: [solid()],
  // Відносні шляхи потрібні для WebView у Capacitor
  base: './',
  // Firebase SDK важить ~800 КБ; для застосунку з одним екраном ділити бандл немає сенсу
  build: { target: 'es2020', chunkSizeWarningLimit: 1200 },
});
