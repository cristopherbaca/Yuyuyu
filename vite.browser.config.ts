import { APP_NAME } from './src/shared/app'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwind from '@tailwindcss/vite'
import { resolve } from 'node:path'
export default defineConfig({
  root: resolve('src/renderer'),
  plugins: [
    react(),
    tailwind(),
    {
      name: 'browser-csp',
      transformIndexHtml(html) {
        return html
          .replace('__APP_NAME__', APP_NAME)
          .replace('__SCRIPT_POLICY__', " 'unsafe-inline'")
          .replace('__CONNECT_POLICY__', ' ws://localhost:* ws://127.0.0.1:*')
      },
    },
  ],
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
})
