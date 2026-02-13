import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        spotlight: fileURLToPath(new URL('./spotlight.html', import.meta.url)),
      },
    },
  },
});
