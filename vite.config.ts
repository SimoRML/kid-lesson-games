import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(import.meta.dirname, 'src/index.ts'),
      name: 'KidGames',
      fileName: (format) => `kid-games.${format}.js`,
      formats: ['es', 'umd']
    },
    rollupOptions: {
      // Keep output clean
      output: {
        exports: 'named'
      }
    }
  },
  server: {
    port: 3000,
    open: false
  }
});
