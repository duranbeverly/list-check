import { defineConfig } from 'vitest/config';

// GitHub Pages serves the site at https://<user>.github.io/list-check/, so assets need this prefix.
export default defineConfig({
  base: '/list-check/',
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
