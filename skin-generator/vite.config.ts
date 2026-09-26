import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { createApi } from './server/api.mjs'

export default defineConfig({
  server: { host: '127.0.0.1' },
  preview: { host: '127.0.0.1' },
  plugins: [react(), {
    name: 'skinforge-local-api',
    configureServer(server) { server.middlewares.use(createApi()) },
    configurePreviewServer(server) { server.middlewares.use(createApi()) },
  }],
})
