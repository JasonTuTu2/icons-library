import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { customIconUploadPlugin } from './vite.custom-upload-plugin'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

export default defineConfig({
  plugins: [react(), customIconUploadPlugin()],
  resolve: {
    alias: {
      // Dev reads generated JSON from source so upload regen never races dist rebuilds.
      '@JasonTuTu2/icons-catalog': resolve(
        repoRoot,
        'packages/catalog/src/index.ts',
      ),
      '@JasonTuTu2/icons-custom/react': resolve(
        repoRoot,
        'packages/custom-icons/src/react.ts',
      ),
    },
  },
  server: {
    port: 5173,
    fs: {
      allow: [repoRoot],
    },
  },
  build: {
    chunkSizeWarningLimit: 5000,
  },
})
