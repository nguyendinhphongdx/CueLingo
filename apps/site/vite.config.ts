import { resolve } from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Two static pages: the intro (index.html) and the install guide (download/index.html).
// `base` is `/<repo>/` on GitHub Pages; the workflow passes it as SITE_BASE.
export default defineConfig({
  base: process.env.SITE_BASE ?? '/',
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      input: {
        home: resolve(import.meta.dirname, 'index.html'),
        download: resolve(import.meta.dirname, 'download/index.html'),
      },
    },
  },
});
