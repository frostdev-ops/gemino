import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    environmentOptions: {
      happyDOM: { url: 'https://www.google.com/search?q=test' },
    },
    include: ['tests/unit/**/*.test.ts'],
  },
});
