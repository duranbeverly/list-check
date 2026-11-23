import { defineConfig } from 'vitest/config';

// Strict CSP only on the published build; Vite's dev server injects inline styles.
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "font-src 'self'",
  "img-src 'self' data:",
  "connect-src 'self'",
  "worker-src 'self'",
  "form-action 'none'",
  "base-uri 'none'",
].join('; ');

// GitHub Pages serves the site under /list-check/.
export default defineConfig({
  base: '/list-check/',
  plugins: [
    {
      name: 'content-security-policy',
      apply: 'build',
      transformIndexHtml(html) {
        return html.replace(
          '<!-- CSP -->',
          `<meta http-equiv="Content-Security-Policy" content="${CONTENT_SECURITY_POLICY}" />`,
        );
      },
    },
  ],
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
