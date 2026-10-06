import { ipcMain, shell, dialog, type BrowserWindow } from 'electron'
import { writeFile } from 'node:fs/promises'
import { z } from 'zod'
import { externalUrlSchema, exportSchema, type Result } from '../../shared/ipc'
export function registerDesktopIpc(getWindow: () => BrowserWindow | null) {
  function register<T, R>(
    channel: string,
    schema: z.ZodType<T>,
    handle: (input: T, window: BrowserWindow) => Promise<R>,
  ) {
    ipcMain.handle(channel, async (event, raw: unknown): Promise<Result<R>> => {
      const window = getWindow()
      if (
        !window ||
        event.sender !== window.webContents ||
        event.senderFrame !== window.webContents.mainFrame
      )
        return { ok: false, error: { code: 'FORBIDDEN', message: 'Origen no permitido.' } }
      const parsed = schema.safeParse(raw)
      if (!parsed.success)
        return { ok: false, error: { code: 'INVALID_INPUT', message: 'Solicitud inválida.' } }
      try {
        return { ok: true, data: await handle(parsed.data, window) }
      } catch {
        return {
          ok: false,
          error: { code: 'OPERATION_FAILED', message: 'No se pudo completar la operación.' },
        }
      }
    })
  }
  register('desktop:openExternal', externalUrlSchema, async (url) => {
    await shell.openExternal(url)
    return null
  })
  register('desktop:exportJson', exportSchema, async (json, window) => {
    const result = await dialog.showSaveDialog(window, {
      defaultPath: 'dynamic-flashcards-demo.json',
      filters: [{ name: 'JSON', extensions: ['json'] }],
    })
    if (result.canceled || !result.filePath) return { canceled: true }
    await writeFile(result.filePath, json, { encoding: 'utf8', mode: 0o600 })
    return { canceled: false }
  })
}
