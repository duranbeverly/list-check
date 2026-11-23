import { env } from 'node:process';
import { defineConfig } from '@playwright/test';

// Run browser tests against Vite with the same base path as GitHub Pages.
export default defineConfig({
  testDir: './e2e',
  use: {
    baseURL: 'http://127.0.0.1:4173/list-check/',
    browserName: 'chromium',
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173/list-check/',
    reuseExistingServer: !env.CI,
    timeout: 120_000,
  },
});
