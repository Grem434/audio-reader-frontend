import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      // Esto permite que puedas usar el import "virtual:pwa-register"
      injectRegister: null,

      includeAssets: ["favicon.svg", "robots.txt", "apple-touch-icon.png"],

      manifest: {
        name: "Audio Reader",
        short_name: "AudioReader",
        description: "Convierte libros PDF/EPUB en audio y continúa donde lo dejaste.",
        theme_color: "#0b0d10",
        background_color: "#0b0d10",
        display: "standalone",
        scope: "/",
        start_url: "/",
        icons: [
          {
            src: "/pwa-192x192.png",
            sizes: "192x192",
            type: "image/png"
          },
          {
            src: "/pwa-512x512.png",
            sizes: "512x512",
            type: "image/png"
          },
          {
            src: "/pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable"
          }
        ]
      },

      // En dev, deja la PWA activa para que puedas probar.
      devOptions: {
        enabled: true
      },

      // Cache básico y reglas para NO cachear la API (NetworkOnly)
      workbox: {
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.destination === "document",
            handler: "NetworkFirst",
            options: {
              cacheName: "pages"
            }
          },
          {
            urlPattern: ({ request }) =>
              request.destination === "script" || request.destination === "style",
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "assets"
            }
          },
          {
            urlPattern: ({ request }) => request.destination === "image",
            handler: "CacheFirst",
            options: {
              cacheName: "images",
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 días
              }
            }
          },
          {
            urlPattern: ({ url }) => url.pathname.startsWith("/api/"),
            handler: "NetworkOnly"
          }
        ]
      }
    })
  ],

  server: {
    proxy: {
      "/api": { target: "http://localhost:4000", changeOrigin: true },
      "/audio": { target: "http://localhost:4000", changeOrigin: true }
    }
  }
});
