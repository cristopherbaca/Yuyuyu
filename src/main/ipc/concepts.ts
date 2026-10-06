import type { Register } from './register'
import type { Services } from '../services/container'
export function registerConcepts(register: Register, s: Services) {
  register('concepts:create', (input) => s.concepts.create(input))
  register('concepts:list', () => s.concepts.list())
  register('concepts:get', (id) => s.concepts.get(id))
  register('concepts:update', ({ id, changes }) => s.concepts.update(id, changes))
  register('concepts:delete', (id) => s.concepts.delete(id))
  register('concepts:generate', ({ id, n }) => {
    s.concepts.get(id)
    return s.jobs.concept(id, n)
  })
  register('edges:confirm', (id) => s.concepts.edgeStatus(id, 'confirmed'))
  register('edges:reject', (id) => s.concepts.edgeStatus(id, 'rejected'))
}
