import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    // The app is same-origin; without this Vite's default lets other localhost ports call the API.
    cors: false,
    proxy: { '/api': 'http://127.0.0.1:3000' },
  },
})
