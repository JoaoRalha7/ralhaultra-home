import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    minify: 'terser',
    sourcemap: false,
    terserOptions: {
      compress: { drop_console: true, drop_debugger: true },
      mangle: true,
    },
  },
});
