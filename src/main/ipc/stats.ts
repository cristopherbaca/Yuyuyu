import { dialog } from 'electron'
import { writeFile } from 'node:fs/promises'
import type { Register } from './register'
import type { Services } from '../services/container'
export function registerStats(register: Register, s: Services) {
  register('stats:get', () => s.stats.get())
  register('data:seed', () => s.data.seed())
  register('data:export', async () => {
    const result = await dialog.showSaveDialog({ title: 'Exportar datos', defaultPath: 'dynamic-flashcards.json', filters: [{ name: 'JSON', extensions: ['json'] }] })
    if (result.canceled || !result.filePath) return { canceled: true }
    await writeFile(result.filePath, JSON.stringify(s.data.export(), null, 2), { mode: 0o600 })
    return { canceled: false }
  })
}
