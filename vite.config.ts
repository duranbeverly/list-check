import { defineConfig } from 'vite';

// GitHub Pages serves the site at https://<user>.github.io/list-check/, so assets need this prefix.
export default defineConfig({
  base: '/list-check/',
});
