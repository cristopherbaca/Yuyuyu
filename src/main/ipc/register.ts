import { ipcMain, type BrowserWindow } from 'electron'
import { z } from 'zod'
import { ipcSchemas, type Channel, type Payload, type Responses } from '../../shared/ipc'
import type { Result } from '../../shared/domain'
export function registrar(getWindow: () => BrowserWindow | null) {
  return function register<C extends Channel>(
    channel: C,
    handler: (payload: Payload<C>) => Responses[C] | Promise<Responses[C]>,
  ) {
    ipcMain.handle(channel, async (event, raw: unknown): Promise<Result<Responses[C]>> => {
      const window = getWindow()
      if (
        !window ||
        event.sender !== window.webContents ||
        event.senderFrame !== window.webContents.mainFrame
      )
        return {
          ok: false,
          error: { code: 'FORBIDDEN', message: 'Origen de solicitud no permitido.' },
        }
      try {
        // The mapped channel narrows the schema at runtime; the assertion preserves that relationship for TS.
        const payload = ipcSchemas[channel].parse(raw) as Payload<C>
        return { ok: true, data: await handler(payload) }
      } catch (error) {
        if (error instanceof z.ZodError)
          return {
            ok: false,
            error: { code: 'INVALID_INPUT', message: 'La solicitud contiene datos inválidos.' },
          }
        return {
          ok: false,
          error: {
            code: 'OPERATION_FAILED',
            message: error instanceof Error ? error.message : 'No se pudo completar la operación.',
          },
        }
      }
    })
  }
}
export type Register = ReturnType<typeof registrar>
