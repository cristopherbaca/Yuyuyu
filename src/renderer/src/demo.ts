import { z } from 'zod'
export const modeSchema = z.enum(['simple', 'problem', 'both'])
export type Mode = z.infer<typeof modeSchema>
export const conceptInputSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    noteText: z.string().trim().min(1).max(40000),
    modePref: modeSchema,
  })
  .strict()
const conceptSchema = conceptInputSchema.extend({ id: z.string().uuid(), createdAt: z.number() })
const reviewSchema = z.object({
  id: z.string().uuid(),
  conceptId: z.string().uuid(),
  rating: z.number().int().min(1).max(4),
  reviewedAt: z.number(),
})
const dataSchema = z.object({
  version: z.literal(1),
  concepts: z.array(conceptSchema),
  reviews: z.array(reviewSchema),
})
export type Concept = z.infer<typeof conceptSchema>
export type DemoReview = z.infer<typeof reviewSchema>
export type DemoData = z.infer<typeof dataSchema>
export const DEMO_KEY = 'dynamic-flashcards.frontend-demo.v1'
export interface StoragePort {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}
const empty = (): DemoData => ({ version: 1, concepts: [], reviews: [] })
export const samples: z.infer<typeof conceptInputSchema>[] = [
  {
    title: 'Teorema de Pitágoras',
    modePref: 'both',
    noteText:
      'En un triángulo rectángulo, los catetos $a$ y $b$ y la hipotenusa $c$ cumplen:\n\n$$a^2 + b^2 = c^2$$\n\nSi los catetos miden 3 y 4, la hipotenusa mide 5, porque $3^2 + 4^2 = 25 = 5^2$.',
  },
  {
    title: 'Raíz cuadrada y potencias',
    modePref: 'problem',
    noteText:
      'La potencia $x^2$ es el producto de $x$ por sí mismo. La raíz cuadrada principal de un número no negativo es el valor no negativo que, al elevarse al cuadrado, da ese número.\n\nPor ejemplo, $5^2 = 25$ y $\\sqrt{25} = 5$.',
  },
  {
    title: 'Pretérito indefinido vs imperfecto',
    modePref: 'simple',
    noteText:
      'El pretérito indefinido presenta acciones terminadas: «Ayer **estudié** una hora». El imperfecto describe hábitos, estados o acciones en desarrollo en el pasado: «De pequeño **estudiaba** por las tardes».\n\nEn «Mientras estudiaba, sonó el teléfono», el imperfecto da el contexto y el indefinido introduce el suceso.',
  },
]
// A frontend demo store, not a scheduler, grader or generation service.
export function createDemoStore(
  storage?: StoragePort,
  id = () => crypto.randomUUID(),
  clock = () => Date.now(),
) {
  let data = empty()
  let warning = ''
  try {
    const raw = storage?.getItem(DEMO_KEY)
    if (raw) data = dataSchema.parse(JSON.parse(raw) as unknown)
  } catch {
    warning =
      'No se pudieron leer los datos de demostración. Puedes exportar tus cambios antes de cerrar.'
  }
  const listeners = new Set<() => void>()
  function commit(next: DemoData) {
    // Keep the current session usable even if browser storage is unavailable/full.
    try {
      storage?.setItem(DEMO_KEY, JSON.stringify(next))
      warning = storage ? '' : 'Almacenamiento no disponible; los cambios duran esta sesión.'
    } catch {
      warning =
        'No se pudieron guardar los cambios en este dispositivo. Exporta tus datos antes de cerrar.'
    }
    data = next
    listeners.forEach((listener) => listener())
  }
  return {
    getSnapshot: () => data,
    getWarning: () => warning,
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    create(input: z.infer<typeof conceptInputSchema>) {
      const concept: Concept = { ...conceptInputSchema.parse(input), id: id(), createdAt: clock() }
      commit({ ...data, concepts: [...data.concepts, concept] })
      return concept
    },
    update(conceptId: string, input: z.infer<typeof conceptInputSchema>) {
      const changes = conceptInputSchema.parse(input)
      if (!data.concepts.some((c) => c.id === conceptId)) throw new Error('Concepto no encontrado.')
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
      const additions = samples
        .filter((sample) => !data.concepts.some((c) => c.title === sample.title))
        .map((sample) => ({ ...sample, id: id(), createdAt: clock() }))
      commit({ ...data, concepts: [...data.concepts, ...additions] })
      return additions.length
    },
    review(conceptId: string, rating: number) {
      const review = reviewSchema.parse({ id: id(), conceptId, rating, reviewedAt: clock() })
      if (!data.concepts.some((c) => c.id === conceptId)) throw new Error('Concepto no encontrado.')
      commit({ ...data, reviews: [...data.reviews, review] })
    },
    export: () => JSON.stringify(data, null, 2),
  }
}
