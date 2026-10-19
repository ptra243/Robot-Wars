import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// https://vite.dev/config/
export default defineConfig({
  // Local/dev: `/`. GitHub Pages CI sets VITE_BASE=/Robot-Wars/
  base: process.env.VITE_BASE || '/',
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/test/**/*.test.ts'],
  },
});
