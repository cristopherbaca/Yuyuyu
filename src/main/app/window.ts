import { BrowserWindow, screen } from 'electron'
import { join } from 'node:path'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { z } from 'zod'
const boundsSchema = z.object({ width: z.number().min(700).max(6000), height: z.number().min(500).max(4000), x: z.number().optional(), y: z.number().optional() })
export function createWindow(userData: string) {
  const file = join(userData, 'window.json')
  let bounds: z.infer<typeof boundsSchema> = { width: 1200, height: 820 }
  if (existsSync(file)) {
    try { bounds = boundsSchema.parse(JSON.parse(readFileSync(file, 'utf8')) as unknown) } catch { /* ignore stale bounds */ }
  }
  if (bounds.x !== undefined && bounds.y !== undefined && !screen.getAllDisplays().some(d => bounds.x! >= d.bounds.x && bounds.x! < d.bounds.x + d.bounds.width && bounds.y! >= d.bounds.y && bounds.y! < d.bounds.y + d.bounds.height)) { delete bounds.x; delete bounds.y }
  const window = new BrowserWindow({ ...bounds, minWidth: 800, minHeight: 600, show: false, backgroundColor: '#f5f4ef', title: 'Dynamic Flashcards', webPreferences: { preload: join(import.meta.dirname, '../preload/index.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true } })
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  window.webContents.on('will-navigate', event => event.preventDefault())
  window.webContents.on('will-redirect', event => event.preventDefault())
  window.on('close', () => writeFileSync(file, JSON.stringify(window.getBounds()), { mode: 0o600 }))
  window.once('ready-to-show', () => window.show())
  if (process.env.ELECTRON_RENDERER_URL) void window.loadURL(process.env.ELECTRON_RENDERER_URL)
  else void window.loadFile(join(import.meta.dirname, '../renderer/index.html'))
  return window
}
