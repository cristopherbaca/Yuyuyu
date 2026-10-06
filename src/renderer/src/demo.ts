import { z } from 'zod'
export const modeSchema = z.enum(['simple', 'problem', 'both'])
export type Mode = z.infer<typeof modeSchema>
export const conceptInputSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    noteText: z.string().trim().min(1).max(40000),
    modePref: modeSchema,
    deckId: z.string().uuid().optional(),
  })
  .strict()
const deckSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(100),
  createdAt: z.number(),
})
const conceptSchema = conceptInputSchema.extend({
  id: z.string().uuid(),
  createdAt: z.number(),
  deckId: z.string().uuid(),
  state: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]).default(0),
  due: z.number().nullable().default(null),
  memory: z.number().min(0).max(1).nullable().default(null),
})
const reviewSchema = z.object({
  id: z.string().uuid(),
  conceptId: z.string().uuid(),
  rating: z.number().int().min(1).max(4),
  reviewedAt: z.number(),
  seconds: z.number().default(0),
  errorSummary: z.string().nullable().default(null),
})
const dataSchema = z.object({
  version: z.literal(2),
  decks: z.array(deckSchema),
  concepts: z.array(conceptSchema),
  reviews: z.array(reviewSchema),
})
export type Concept = z.infer<typeof conceptSchema>
export type Deck = z.infer<typeof deckSchema>
export type DemoReview = z.infer<typeof reviewSchema>
export type DemoData = z.infer<typeof dataSchema>
export const DEMO_KEY = 'dynamic-flashcards.frontend-demo.v1'
export interface StoragePort {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}
const empty = (): DemoData => ({ version: 2, decks: [], concepts: [], reviews: [] })
export const samples: z.infer<typeof conceptInputSchema>[] = [
  {
    title: 'Teorema de Pitágoras',
    modePref: 'both',
    noteText:
      'En un triángulo rectángulo, los catetos $a$ y $b$ y la hipotenusa $c$ cumplen:\n\n$$a^2+b^2=c^2$$\n\nSi los catetos miden 3 y 4, la hipotenusa mide 5, porque $3^2+4^2=25=5^2$.',
  },
  {
    title: 'Raíz cuadrada y potencias',
    modePref: 'problem',
    noteText:
      'La potencia $x^2$ es el producto de $x$ por sí mismo. La raíz cuadrada principal es el valor no negativo que, al elevarse al cuadrado, da ese número.\n\nPor ejemplo, $5^2=25$ y $\\sqrt{25}=5$.',
  },
  {
    title: 'Pretérito indefinido vs imperfecto',
    modePref: 'simple',
    noteText:
      'El pretérito indefinido presenta acciones terminadas: «Ayer **estudié** una hora». El imperfecto describe hábitos, estados o acciones en desarrollo: «De pequeño **estudiaba** por las tardes».\n\nEn «Mientras estudiaba, sonó el teléfono», el imperfecto da el contexto y el indefinido introduce el suceso.',
  },
]
export function deckCounts(data: DemoData, deckId?: string, now = Date.now()) {
  const cards = data.concepts.filter((c) => !deckId || c.deckId === deckId)
  return {
    new: cards.filter((c) => c.state === 0).length,
    learning: cards.filter(
      (c) => (c.state === 1 || c.state === 3) && (c.due === null || c.due <= now),
    ).length,
    due: cards.filter((c) => c.state === 2 && c.due !== null && c.due <= now).length,
  }
}
export function createDemoStore(
  storage?: StoragePort,
  id = () => crypto.randomUUID(),
  clock = () => Date.now(),
) {
  let data = empty(),
    warning = ''
  const listeners = new Set<() => void>()
  try {
    const raw = storage?.getItem(DEMO_KEY)
    if (raw) {
      const parsed: unknown = JSON.parse(raw)
      // Preserve v1 notes/reviews, grouping them in General. Validate before migrating.
      const legacy = z
        .object({
          version: z.literal(1),
          concepts: z.array(
            conceptInputSchema.extend({ id: z.string().uuid(), createdAt: z.number() }),
          ),
          reviews: z.array(reviewSchema),
        })
        .safeParse(parsed)
      if (legacy.success) {
        const deck = { id: id(), name: 'General', createdAt: clock() }
        data = dataSchema.parse({
          version: 2,
          decks: [deck],
          concepts: legacy.data.concepts.map((c) => ({ ...c, deckId: deck.id })),
          reviews: legacy.data.reviews,
        })
        storage?.setItem(DEMO_KEY, JSON.stringify(data))
      } else data = dataSchema.parse(parsed)
      if (data.concepts.some((c) => !data.decks.some((d) => d.id === c.deckId)))
        throw new Error('Missing deck')
    }
  } catch {
    warning = 'No se pudieron leer los datos locales. Exporta tus cambios antes de cerrar.'
    data = empty()
  }
  function commit(next: DemoData) {
    try {
      storage?.setItem(DEMO_KEY, JSON.stringify(next))
      warning = storage
        ? ''
        : 'Los cambios duran esta sesión. Exporta tus tarjetas antes de cerrar.'
    } catch {
      warning = 'No se pudieron guardar los cambios. Exporta tus tarjetas antes de cerrar.'
    }
    data = next
    listeners.forEach((listener) => listener())
  }
  function requireDeck(deckId: string) {
    if (!data.decks.some((d) => d.id === deckId)) throw new Error('Mazo no encontrado.')
  }
  const store = {
    getSnapshot: () => data,
    getWarning: () => warning,
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    createDeck(name: string) {
      const deck = deckSchema.parse({ id: id(), name, createdAt: clock() })
      commit({ ...data, decks: [...data.decks, deck] })
      return deck
    },
    renameDeck(deckId: string, name: string) {
      requireDeck(deckId)
      const value = deckSchema.shape.name.parse(name)
      commit({
        ...data,
        decks: data.decks.map((d) => (d.id === deckId ? { ...d, name: value } : d)),
      })
    },
    deleteDeck(deckId: string) {
      requireDeck(deckId)
      const deleted = new Set(data.concepts.filter((c) => c.deckId === deckId).map((c) => c.id))
      commit({
        ...data,
        decks: data.decks.filter((d) => d.id !== deckId),
        concepts: data.concepts.filter((c) => !deleted.has(c.id)),
        reviews: data.reviews.filter((r) => !deleted.has(r.conceptId)),
      })
    },
    create(input: z.infer<typeof conceptInputSchema>) {
      const parsed = conceptInputSchema.parse(input)
      const deckId = parsed.deckId ?? data.decks[0]?.id ?? store.createDeck('General').id
      requireDeck(deckId)
      const concept = conceptSchema.parse({ ...parsed, deckId, id: id(), createdAt: clock() })
      commit({ ...data, concepts: [...data.concepts, concept] })
      return concept
    },
    update(conceptId: string, input: z.infer<typeof conceptInputSchema>) {
      const changes = conceptInputSchema.parse(input)
      if (!data.concepts.some((c) => c.id === conceptId)) throw new Error('Tarjeta no encontrada.')
      if (changes.deckId) requireDeck(changes.deckId)
      commit({
        ...data,
        concepts: data.concepts.map((c) => (c.id === conceptId ? { ...c, ...changes } : c)),
      })
    },
    delete(conceptId: string) {
      commit({
        ...data,
        concepts: data.concepts.filter((c) => c.id !== conceptId),
        reviews: data.reviews.filter((r) => r.conceptId !== conceptId),
      })
    },
    seed() {
      const additions = samples.filter(
        (sample) => !data.concepts.some((c) => c.title === sample.title),
      )
      if (!additions.length) return 0
      const deck = data.decks.find((d) => d.name === 'Ejemplos') ?? store.createDeck('Ejemplos')
      additions.forEach((sample) => store.create({ ...sample, deckId: deck.id }))
      return additions.length
    },
    review(conceptId: string, rating: number, seconds = 0, errorSummary: string | null = null) {
      const review = reviewSchema.parse({
        id: id(),
        conceptId,
        rating,
        reviewedAt: clock(),
        seconds,
        errorSummary,
      })
      if (!data.concepts.some((c) => c.id === conceptId)) throw new Error('Tarjeta no encontrada.')
      // Local practice state only. No invented memory/FSRS schedule or intervals.
      commit({
        ...data,
        reviews: [...data.reviews, review],
        concepts: data.concepts.map((c) =>
          c.id === conceptId ? { ...c, state: rating === 1 ? (1 as const) : (2 as const) } : c,
        ),
      })
      return review
    },
    replaceFixtures(fixtures: DemoData) {
      commit(dataSchema.parse(fixtures))
    },
    export: () => JSON.stringify(data, null, 2),
  }
  return store
}
