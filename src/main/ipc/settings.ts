import { shell } from 'electron'
import type { Register } from './register'
import type { Services } from '../services/container'
export function registerSettings(
  register: Register,
  s: Services,
  refresh: (reset?: boolean) => void,
) {
  register('settings:get', () => {
    refresh()
    return s.settings.publicGet()
  })
  register('settings:set', (input) => {
    const value = s.settings.set(input)
    refresh(true)
    s.jobs.refillNow()
    return value
  })
  register('settings:setApiKey', (input) => {
    const value = s.settings.setApiKey(input)
    refresh(true)
    s.jobs.refillNow()
    return value
  })
  register('app:openExternal', async (url) => {
    await shell.openExternal(url)
    return null
  })
}
