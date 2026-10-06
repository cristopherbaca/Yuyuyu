import { describe, expect, it } from 'vitest'
import { createDemoStore, DEMO_KEY, type StoragePort } from '../src/renderer/src/demo'
import { readTheme, THEME_KEY } from '../src/renderer/src/theme'
import { externalUrlSchema, exportSchema } from '../src/shared/ipc'
function memory(): StoragePort {
  const values = new Map<string, string>()
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value)
    },
  }
}
const input = { title: ' Mi concepto ', noteText: ' Mi nota ', modePref: 'both' as const }
describe('frontend demo data', () => {
  it('persists notes and self-ratings across reloads, and cascades deletion', () => {
    const storage = memory(),
      store = createDemoStore(storage)
    const concept = store.create(input)
    store.review(concept.id, 3)
    const restored = createDemoStore(storage)
    expect(restored.getSnapshot().concepts[0].title).toBe('Mi concepto')
    expect(restored.getSnapshot().reviews).toHaveLength(1)
    restored.delete(concept.id)
    expect(createDemoStore(storage).getSnapshot()).toEqual({
      version: 2,
      decks: restored.getSnapshot().decks,
      concepts: [],
      reviews: [],
    })
  })
  it('loads examples idempotently and can edit their notes', () => {
    const store = createDemoStore(memory())
    expect(store.seed()).toBe(3)
    expect(store.seed()).toBe(0)
    const concept = store.getSnapshot().concepts[0]
    store.update(concept.id, { ...input, noteText: 'Editada' })
    expect(store.getSnapshot().concepts[0].noteText).toBe('Editada')
    expect(JSON.parse(store.export()).reviews).toEqual([])
  })
  it('rejects empty notes and invalid self-ratings without mutating data', () => {
    const store = createDemoStore(memory())
    expect(() => store.create({ ...input, noteText: ' ' })).toThrow()
    const concept = store.create(input)
    expect(() => store.review(concept.id, 7)).toThrow()
    expect(store.getSnapshot().reviews).toHaveLength(0)
  })
  it('keeps the UI usable and warns if storage is corrupt or unavailable', () => {
    const storage = memory()
    storage.setItem(DEMO_KEY, '{"version":1,"concepts":"corrupt"}')
    const store = createDemoStore(storage)
    expect(store.getWarning()).toMatch(/leer/)
    expect(store.getSnapshot().concepts).toEqual([])
    const unavailable = createDemoStore({
      getItem: () => null,
      setItem: () => {
        throw new Error('Quota')
      },
    })
    unavailable.create(input)
    expect(unavailable.getSnapshot().concepts).toHaveLength(1)
    expect(unavailable.getWarning()).toMatch(/guardar/)
  })
})
describe('appearance and desktop boundary', () => {
  it('uses system appearance on first launch, and respects an explicit choice', () => {
    const storage = memory()
    expect(readTheme(storage, true)).toBe('dark')
    expect(readTheme(storage, false)).toBe('light')
    storage.setItem(THEME_KEY, 'light')
    expect(readTheme(storage, true)).toBe('light')
    storage.setItem(THEME_KEY, 'dark')
    expect(readTheme(storage, false)).toBe('dark')
    storage.setItem(THEME_KEY, 'invalid')
    expect(readTheme(storage, false)).toBe('light')
    expect(
      readTheme(
        {
          getItem: () => {
            throw new Error('Denied')
          },
        },
        true,
      ),
    ).toBe('dark')
  })
  it('allows only HTTPS external links and valid size-limited JSON exports', () => {
    expect(externalUrlSchema.safeParse('https://example.com').success).toBe(true)
    for (const url of ['javascript:alert(1)', 'file:///tmp/file', 'http://example.com'])
      expect(externalUrlSchema.safeParse(url).success).toBe(false)
    expect(exportSchema.safeParse('{"concepts":[]}').success).toBe(true)
    expect(exportSchema.safeParse('not json').success).toBe(false)
    expect(exportSchema.safeParse('"' + 'a'.repeat(2_000_000) + '"').success).toBe(false)
  })
})
