import type { DesktopApi, Result } from '../../shared/ipc'
declare global {
  interface Window {
    desktop?: DesktopApi
  }
}
export async function unwrap<T>(promise: Promise<Result<T>>): Promise<T> {
  const result = await promise
  if (!result.ok) throw new Error(result.error.message)
  return result.data
}
export function message(error: unknown) {
  return error instanceof Error ? error.message : 'No se pudo completar la operación.'
}
export function date(timestamp: number) {
  return new Date(timestamp).toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short' })
}
