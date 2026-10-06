import { describe, expect, it } from 'vitest'
import { createDatabase } from '../src/main/db/client'
import { concepts } from '../src/main/db/schema'
import { SettingsService } from '../src/main/services/settings'
import { FsrsService } from '../src/main/services/fsrs'
describe('local foundation', () => {
  it('migrates an in-memory SQLite database with foreign keys', () => {
    const connection = createDatabase()
    const clock = () => new Date('2026-10-05T10:00:00Z')
    const fsrs = new FsrsService(() => 0.9, clock)
    connection.db.insert(concepts).values({ id: 'test', title: 'Concepto', noteText: 'Nota', ...fsrs.columns(fsrs.create()), createdAt: clock().getTime() }).run()
    expect(connection.db.select().from(concepts).get()?.modePref).toBe('both')
    connection.close()
  })
  it('never returns the secret and validates settings', () => {
    let key: string | null = null
    const settings = new SettingsService(null, { has: () => key !== null, get: () => key, set: value => { key = value }, warning: () => null })
    settings.setApiKey('secret-test')
    expect(settings.publicGet().apiKeySet).toBe(true)
    expect(JSON.stringify(settings.publicGet())).not.toContain('secret-test')
    expect(() => settings.set({ desiredRetention: 2 })).toThrow()
  })
})
