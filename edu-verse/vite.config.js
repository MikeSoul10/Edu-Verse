import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    watch: {
      usePolling: true,
    },
    proxy: {
      '/auth': 'http://backend:4000',
      '/apuntes': 'http://backend:4000',
      '/favoritos': 'http://backend:4000',
      '/usuarios': 'http://backend:4000',
      '/comentarios': 'http://backend:4000',
      '/valoraciones': 'http://backend:4000',
      '/equipos': 'http://backend:4000',
      '/tareas': 'http://backend:4000',
      '/chat': 'http://backend:4000',
      '/admin': 'http://backend:4000',
      '/uploads': 'http://backend:4000',
      // Tutor IA: las respuestas con búsqueda web tardan 30–60 s.
      '/api': {
        target: 'http://backend:4000',
        timeout: 120000,
        proxyTimeout: 120000,
      },
      '/socket.io': {
        target: 'http://backend:4000',
        ws: true,
      },
    },
  },
})
