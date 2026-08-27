import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { execSync } from 'child_process';

// ── Version stamping ────────────────────────────────────────────────────
// The app version is derived from git at build time and injected, so the
// badge in the header, the sidebar and About can never disagree again.
// See version.ts for the scheme.
const git = (cmd: string, fallback: string): string => {
  try {
    return execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return fallback; // building outside a git checkout (CI tarball, etc.)
  }
};

const now = new Date();
const buildNumber = parseInt(git('git rev-list --count HEAD', '0'), 10) || 0;
const buildRevision = parseInt(git('git log --since=midnight --oneline', '').split('\n').filter(Boolean).length.toString(), 10) || 0;
const buildDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

export default defineConfig({
  plugins: [react(), viteSingleFile()],
  define: {
    __BUILD_NUMBER__: JSON.stringify(buildNumber),
    __BUILD_MONTH__: JSON.stringify(now.getMonth() + 1),
    __BUILD_REVISION__: JSON.stringify(buildRevision),
    __BUILD_DATE__: JSON.stringify(buildDate),
  },
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
      // Booking calls go through the deployed Firebase function even in dev —
      // the Duffel key only exists server-side, never on this machine.
      '/duffel': {
        target: 'https://urtc-app.web.app',
        changeOrigin: true,
      },
    },
  },
});