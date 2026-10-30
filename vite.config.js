import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // 'prompt': a new version waits for the user's tap, so it can never reload the page mid-recording
      registerType: 'prompt',
      manifest: false,
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json}'],
        // Tapping a reminder opens the app (public/notification-click.js)
        importScripts: ['notification-click.js'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024
      }
    })
  ],
  server: {
    host: true,
  }
})
