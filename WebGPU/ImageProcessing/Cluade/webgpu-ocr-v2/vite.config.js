import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    target: 'esnext',
    outDir: 'dist',
    rollupOptions: {
      output: { manualChunks: { onnx: ['onnxruntime-web'], jszip: ['jszip'] } }
    }
  },
  server: { port: 5173, headers: {
    // Required for SharedArrayBuffer (ONNX WebGPU EP)
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Embedder-Policy': 'require-corp',
  }},
  optimizeDeps: { exclude: ['onnxruntime-web'] },
});
