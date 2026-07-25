import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
  plugins: [react(), viteSingleFile()],
  // Only scan the real entry — never the compiled copies inside android/ios/dist
  optimizeDeps: {
    entries: ['index.html'],
  },
  server: {
    host: true,
    watch: {
      ignored: ['**/android/**', '**/ios/**', '**/dist/**', '**/functions/**'],
    },
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
      '/aeroapi': {
        target: 'https://aeroapi.flightaware.com',
        changeOrigin: true,
      },
    },
  },
});