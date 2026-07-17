import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { customIconUploadPlugin } from './vite.custom-upload-plugin'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const packageVersion = (
  JSON.parse(
    readFileSync(resolve(repoRoot, 'packages/react/package.json'), 'utf8'),
  ) as { version: string }
).version

export default defineConfig(({ command }) => {
  const rootDir = dirname(fileURLToPath(import.meta.url))
  return {
    // GitHub Pages serves at https://JasonTuTu2.github.io/icons-library/
    base: command === 'build' ? '/icons-library/' : '/',
    plugins: [react(), customIconUploadPlugin()],
    define: {
      'import.meta.env.VITE_PACKAGE_VERSION': JSON.stringify(packageVersion),
    },
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
      rollupOptions: {
        input: {
          main: resolve(rootDir, 'index.html'),
          figma: resolve(rootDir, 'figma.html'),
        },
      },
    },
  }
})
