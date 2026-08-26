import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  root: 'web',
  plugins: [react(), tailwindcss()],
  build: { outDir: '../dist/client', emptyOutDir: true },
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:8787',
      '/audio': 'http://127.0.0.1:8787',
    },
  },
});
