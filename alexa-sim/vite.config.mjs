import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  base: '/alexa-sim/',
  build: { outDir: '../dist/alexa-sim', emptyOutDir: false },
  server: { port: 5174, proxy: { '/mcp': 'http://127.0.0.1:8790', '/alexa-sim/api': 'http://127.0.0.1:8790' } },
});
