import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Relative base so the build works at any path (e.g. GitHub Pages /<repo>/geo-tracker/).
export default defineConfig({
  base: './',
  define: {
    __APP_BUILD__: JSON.stringify(new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC'),
  },
  plugins: [react()],
  test: {
    environment: 'node',
  },
});
