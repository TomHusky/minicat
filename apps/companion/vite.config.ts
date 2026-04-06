import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    outDir: 'dist/renderer'
  },
  resolve: {
    alias: {
      '@renderer': resolve(__dirname, 'src/renderer')
    }
  }
});
