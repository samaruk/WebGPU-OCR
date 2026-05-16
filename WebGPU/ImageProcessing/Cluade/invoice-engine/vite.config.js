// vite.config.js
import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  build: {
    outDir: 'dist',
    target: 'esnext',
  },
  assetsInclude: ['**/*.wgsl'],
  server: {
    port: 3000,
    open: true,
  }
});
