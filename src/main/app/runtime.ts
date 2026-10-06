import { app, BrowserWindow } from 'electron'
import { join } from 'node:path'
import { mkdirSync } from 'node:fs'
import { config } from 'dotenv'
import { createDatabase } from '../db/client'
import { createWindow } from './window'
import { SettingsService } from '../services/settings'
import { ElectronSecrets } from '../secrets/store'
export function startApp() {
  if (!app.requestSingleInstanceLock()) { app.quit(); return }
  let window: BrowserWindow | null = null
  app.on('second-instance', () => { if (window?.isMinimized()) window.restore(); window?.focus() })
  app.whenReady().then(() => {
    if (!app.isPackaged) config({ quiet: true })
    const directory = app.getPath('userData')
    mkdirSync(directory, { recursive: true })
    const database = createDatabase(join(directory, 'flashcards.db'))
    const settings = new SettingsService(join(directory, 'settings.json'), new ElectronSecrets(join(directory, 'api-key.bin'), !app.isPackaged ? process.env.OPENAI_API_KEY ?? null : null), !app.isPackaged ? { modelGenerate: process.env.OPENAI_MODEL_GENERATE ?? '', modelVerify: process.env.OPENAI_MODEL_VERIFY ?? '', fakeLlm: process.env.FAKE_LLM === 'true' } : {})
    void settings
    window = createWindow(directory)
    app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) window = createWindow(directory) })
    app.on('will-quit', () => database.close())
  }).catch(error => { console.error('No se pudo iniciar la aplicación:', error instanceof Error ? error.message : 'Error desconocido'); app.quit() })
  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
}
