import type { Register } from './register'
import type { Services } from '../services/container'
export function registerJobs(register: Register, s: Services) {
  register('jobs:refillNow', () => s.jobs.refillNow())
}
