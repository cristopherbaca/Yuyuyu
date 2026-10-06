import { z } from 'zod'
export type Result<T> =
  { ok: true; data: T } | { ok: false; error: { code: string; message: string } }
export const externalUrlSchema = z
  .string()
  .url()
  .refine((value) => new URL(value).protocol === 'https:', 'Solo enlaces HTTPS')
export const exportSchema = z
  .string()
  .max(2_000_000)
  .refine((value) => {
    try {
      JSON.parse(value)
      return true
    } catch {
      return false
    }
  }, 'JSON inválido')
// Only desktop capabilities cross IPC. Demo data stays entirely in the renderer.
export interface DesktopApi {
  platform: string
  minimize(): Promise<Result<null>>
  toggleMaximize(): Promise<Result<null>>
  close(): Promise<Result<null>>
  openExternal(url: string): Promise<Result<null>>
  exportJson(json: string): Promise<Result<{ canceled: boolean }>>
}
