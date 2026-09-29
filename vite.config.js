import { defineConfig } from 'vite';
import { localEditor } from './scripts/local-editor.mjs';
export default defineConfig({
  base: './',
  plugins: [localEditor()],
  server: { port: 5173, strictPort: true, fs: { deny: ['**/config/**', '**/.env*', '**/.cache/**', '**/.git/**'] } },
  build: { outDir: 'dist' }
});
