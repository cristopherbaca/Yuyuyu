import { APP_NAME } from './src/shared/app'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import { randomBytes } from 'node:crypto'
import react from '@vitejs/plugin-react'
import tailwind from '@tailwindcss/vite'
const nonce = randomBytes(18).toString('base64')
export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
  },
  preload: {
    plugins: [externalizeDepsPlugin({ exclude: ['zod'] })],
    build: { rollupOptions: { output: { format: 'cjs', entryFileNames: 'index.cjs' } } },
  },
  renderer: {
    html: { cspNonce: nonce },
    plugins: [
      react(),
      tailwind(),
      {
        name: 'local-csp',
        transformIndexHtml: {
          order: 'pre',
          handler: (html, context) =>
            html
              .replace('__APP_NAME__', APP_NAME)
              .replace('__SCRIPT_POLICY__', context.server ? ` 'nonce-${nonce}'` : '')
              .replace(
                '__CONNECT_POLICY__',
                context.server ? ' ws://localhost:* ws://127.0.0.1:*' : '',
              ),
        },
      },
    ],
  },
})
