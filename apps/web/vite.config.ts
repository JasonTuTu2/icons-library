import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { customIconUploadPlugin } from './vite.custom-upload-plugin'

export default defineConfig({
  plugins: [react(), customIconUploadPlugin()],
  server: {
    port: 5173,
  },
  build: {
    chunkSizeWarningLimit: 5000,
  },
})
