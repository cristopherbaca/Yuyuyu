import type { BrowserWindow } from 'electron'
import type { Services } from '../services/container'
import { registrar } from './register'
import { registerConcepts } from './concepts'
import { registerSession } from './session'
import { registerReviews } from './reviews'
import { registerVariants } from './variants'
import { registerJobs } from './jobs'
import { registerStats } from './stats'
import { registerSettings } from './settings'
export function registerIpc(getWindow: () => BrowserWindow | null, services: Services, refresh: () => void) {
  const register = registrar(getWindow)
  registerConcepts(register, services); registerSession(register, services); registerReviews(register, services)
  registerVariants(register, services); registerJobs(register, services); registerStats(register, services); registerSettings(register, services, refresh)
}
