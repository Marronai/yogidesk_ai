import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  base: './', // 👈 Yeh nayi line dhyan se jod do (dot aur slash)
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 1000
  },
});