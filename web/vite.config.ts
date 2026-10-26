import { fileURLToPath, URL } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// `@/` points at the mobile app's src/, so the dashboard reuses its pure rules
// (CSV columns, membership status) instead of keeping a second copy in sync.
export default defineConfig({
  plugins: [react()],
  // Shared files sit under the mobile app's tsconfig, which extends Expo's and
  // needs the root node_modules. Use this one for every file instead.
  tsconfig: './tsconfig.json',
  resolve: {
    alias: { '@': fileURLToPath(new URL('../src', import.meta.url)) },
  },
  server: { fs: { allow: ['..'] } },
});
