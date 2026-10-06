import { app, BrowserWindow } from 'electron'
import { join } from 'node:path'
import { mkdirSync } from 'node:fs'
import { config } from 'dotenv'
import { createDatabase } from '../db/client'
import { createWindow } from './window'
import { SettingsService } from '../services/settings'
import { ElectronSecrets } from '../secrets/store'
import { ConfiguredLlm } from '../llm/client'
import { createServices } from '../services/container'
import { registerIpc } from '../ipc'
import type { LlmStatus } from '../../shared/domain'
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
    const clock = () => new Date()
    let status: LlmStatus = 'idle'
    const llm = new ConfiguredLlm(settings, database.db, clock, value => { status = value; window?.webContents.send('llm:status', value) })
    const services = createServices(database.db, settings, llm, clock, id => window?.webContents.send('pool:updated', id))
    registerIpc(() => window, services, () => llm.refreshStatus())
    const open = () => {
      const next = createWindow(directory)
      next.webContents.on('did-finish-load', () => next.webContents.send('llm:status', status))
      return next
    }
    window = open()
    services.jobs.start()
    app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) window = open() })
    app.on('will-quit', () => { services.jobs.stop(); database.close() })
  }).catch(error => { console.error('No se pudo iniciar la aplicación:', error instanceof Error ? error.message : 'Error desconocido'); app.quit() })
  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
}
