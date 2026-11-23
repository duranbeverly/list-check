import { env } from 'node:process';
import { defineConfig } from '@playwright/test';

// Run browser tests against the production build at the GitHub Pages base path.
export default defineConfig({
  testDir: './e2e',
  workers: 2,
  retries: env.CI ? 1 : 0,
  use: {
    baseURL: 'http://127.0.0.1:4173/list-check/',
    trace: env.CI ? 'on-first-retry' : 'off',
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    { name: 'firefox', use: { browserName: 'firefox' } },
    { name: 'webkit', use: { browserName: 'webkit' } },
  ],
  webServer: {
    command: 'npm run build && npm run preview -- --host 127.0.0.1 --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173/list-check/',
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
