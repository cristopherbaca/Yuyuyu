import type { Register } from './register'
import type { Services } from '../services/container'
export function registerSession(register: Register, s: Services) {
  register('session:build', (input) => s.session.build(input))
}
