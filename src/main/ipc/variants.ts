import type { Register } from './register'
import type { Services } from '../services/container'
export function registerVariants(register: Register, s: Services) { register('variants:report', id => s.variants.report(id)) }
