import { defineConfig } from 'vite';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.config.ts';

export default defineConfig({
  plugins: [crx({ manifest })],
  build: {
    // Readable output so store reviewers (Opera in particular) can audit the code.
    minify: false,
    target: 'es2022',
    emptyOutDir: true,
    // Every supported browser (Chrome 110+, Opera) has native modulepreload; the polyfill is a
    // fetch() that would only confuse store reviewers.
    modulePreload: { polyfill: false },
  },
  server: {
    port: 5173,
    strictPort: true,
    hmr: { port: 5173 },
  },
});
