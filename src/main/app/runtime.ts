import { app, BrowserWindow } from 'electron'
import { resolve } from 'node:path'
import { mkdirSync } from 'node:fs'
import { createWindow } from './window'
import { registerDesktopIpc } from '../ipc'
export function startApp() {
  if (process.env.DYNAMIC_FLASHCARDS_USER_DATA)
    app.setPath('userData', resolve(process.env.DYNAMIC_FLASHCARDS_USER_DATA))
  if (!app.requestSingleInstanceLock()) {
    app.quit()
    return
  }
  let window: BrowserWindow | null = null
  app.on('second-instance', () => {
    if (window?.isMinimized()) window.restore()
    window?.focus()
  })
  app
    .whenReady()
    .then(() => {
      const directory = app.getPath('userData')
      mkdirSync(directory, { recursive: true })
      registerDesktopIpc(() => window)
      const open = () => {
        const next = createWindow(directory)
        next.on('closed', () => {
          if (window === next) window = null
        })
        return next
      }
      window = open()
      app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) window = open()
      })
    })
    .catch(() => {
      console.error('No se pudo iniciar la aplicación.')
      app.quit()
    })
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}
