import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import vueDevTools from 'vite-plugin-vue-devtools'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  // Version affichée dans les erreurs (A6) : la date de construction
  define: { __VERSION_APP__: JSON.stringify(new Date().toISOString().slice(0, 10)) },
  plugins: [
    vue(),
    vueJsx(),
    vueDevTools(),
    VitePWA({
      // RG27 : la mise à jour est proposée par un toast, jamais imposée
      registerType: 'prompt',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
      manifest: {
        name: 'ColokNiamey',
        short_name: 'ColokNiamey',
        description: 'Trouve ta colocation étudiante à Niamey.',
        lang: 'fr',
        theme_color: '#1E3966',
        background_color: '#F5F6F8',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // Le modèle d'analyse des photos (module S, ~3,5 Mo) n'est chargé qu'au premier envoi de photo :
        // inutile de le télécharger à l'installation de l'application.
        globIgnores: ['**/group1-shard*.js', '**/model.min-*.js'],
        // RG27 : page hors ligne au lieu d'une erreur de navigateur
        navigateFallback: '/index.html',
        // RGP08 : tout ce qui vient de Supabase (données authentifiées, images privées,
        // messages) passe toujours par le réseau et n'est jamais mis en cache.
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.hostname.endsWith('.supabase.co'),
            handler: 'NetworkOnly',
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
