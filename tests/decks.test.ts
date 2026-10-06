import { describe, it, expect } from 'vitest'
import { createDemoStore, deckCounts, DEMO_KEY } from '../src/renderer/src/demo'
function storage() {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value)
    },
  }
}
describe('decks', () => {
  it('migrates existing v1 cards and reviews into General without data loss', () => {
    const mem = storage(),
      id = crypto.randomUUID()
    mem.setItem(
      DEMO_KEY,
      JSON.stringify({
        version: 1,
        concepts: [{ id, title: 'Old', noteText: 'Note', modePref: 'both', createdAt: 1 }],
        reviews: [{ id: crypto.randomUUID(), conceptId: id, rating: 3, reviewedAt: 2 }],
      }),
    )
    const store = createDemoStore(mem)
    expect(store.getSnapshot().decks[0].name).toBe('General')
    expect(store.getSnapshot().concepts[0].deckId).toBe(store.getSnapshot().decks[0].id)
    expect(store.getSnapshot().reviews).toHaveLength(1)
    expect(createDemoStore(mem).getSnapshot()).toEqual(store.getSnapshot())
  })
  it('moves cards between decks and deletes only the chosen deck and its history', () => {
    const store = createDemoStore(storage()),
      a = store.createDeck('A'),
      b = store.createDeck('B')
    const card = store.create({ title: 'Card', noteText: 'Back', modePref: 'both', deckId: a.id })
    store.update(card.id, { title: 'Card', noteText: 'Back', modePref: 'both', deckId: b.id })
    store.review(card.id, 1)
    store.deleteDeck(a.id)
    expect(store.getSnapshot().concepts).toHaveLength(1)
    expect(deckCounts(store.getSnapshot(), b.id)).toEqual({ new: 0, learning: 1, due: 0 })
    store.deleteDeck(b.id)
    expect(store.getSnapshot().reviews).toHaveLength(0)
  })
  it('counts review cards only when due, and learning/relearning only when eligible', () => {
    const store = createDemoStore(storage()),
      deck = store.createDeck('A')
    const card = store.create({ title: 'C', noteText: 'N', modePref: 'both', deckId: deck.id })
    const data = store.getSnapshot()
    store.replaceFixtures({
      ...data,
      concepts: [
        { ...card, state: 2, due: 10 },
        { ...card, id: crypto.randomUUID(), state: 3, due: 30 },
        { ...card, id: crypto.randomUUID(), state: 1, due: 5 },
        { ...card, id: crypto.randomUUID(), state: 0, due: null },
      ],
    })
    expect(deckCounts(store.getSnapshot(), deck.id, 20)).toEqual({ new: 1, learning: 1, due: 1 })
  })
  it('rejects invalid decks and leaves data unchanged', () => {
    const store = createDemoStore(storage())
    expect(() => store.createDeck(' ')).toThrow()
    expect(() =>
      store.create({ title: 'A', noteText: 'B', modePref: 'both', deckId: crypto.randomUUID() }),
    ).toThrow()
    expect(store.getSnapshot().concepts).toHaveLength(0)
  })
})
