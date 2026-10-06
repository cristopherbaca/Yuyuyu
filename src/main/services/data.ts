import { randomUUID } from 'node:crypto'
import type { Db } from '../db/client'
import { concepts, edges, variants, reviews } from '../db/schema'
import type { ConceptService } from './concepts'
export const SEED_NOTES = [
  {
    title: 'Teorema de Pitágoras',
    modePref: 'both' as const,
    noteText:
      'En un triángulo rectángulo, los catetos a y b y la hipotenusa c cumplen a² + b² = c². La hipotenusa es el lado opuesto al ángulo recto y el más largo. Para hallar la hipotenusa se usa c = √(a² + b²). Por ejemplo, con catetos 3 y 4, c = √(9 + 16) = 5. Para hallar un cateto se resta el cuadrado del otro al de la hipotenusa y se toma la raíz positiva. Este teorema solo se aplica a triángulos rectángulos.',
  },
  {
    title: 'Raíz cuadrada y potencias',
    modePref: 'both' as const,
    noteText:
      'La raíz cuadrada principal de un número no negativo es el número no negativo cuyo cuadrado es ese número. Elevar al cuadrado significa multiplicar un número por sí mismo: 5² = 25 y √25 = 5. La raíz cuadrada principal es no negativa; la ecuación x² = 25 tiene dos soluciones, x = 5 y x = −5. Las potencias y raíces permiten despejar incógnitas en relaciones cuadráticas.',
  },
  {
    title: 'Pretérito indefinido vs imperfecto',
    modePref: 'both' as const,
    noteText:
      'El pretérito indefinido presenta acciones pasadas como terminadas y delimitadas: «Ayer caminé al parque». El imperfecto describe hábitos, contextos o acciones en desarrollo en el pasado: «De niño caminaba al parque cada tarde». En «Llovía cuando llegué», llovía aporta el contexto en desarrollo y llegué marca un evento delimitado. La elección depende de cómo se presenta la acción, no solo de cuánto duró.',
  },
]
export class DataService {
  constructor(
    private db: Db,
    private service: ConceptService,
  ) {}
  seed() {
    const existing = this.service.list()
    const ids = SEED_NOTES.map(
      (note) => existing.find((c) => c.title === note.title)?.id ?? this.service.create(note).id,
    )
    this.db
      .insert(edges)
      .values({
        id: randomUUID(),
        fromId: ids[1]!,
        toId: ids[0]!,
        relation: 'prerequisite_of',
        status: 'confirmed',
        rationale: 'Despejar la hipotenusa requiere potencias y raíces cuadradas.',
      })
      .onConflictDoNothing()
      .run()
    return {
      created: SEED_NOTES.filter((note) => !existing.some((c) => c.title === note.title)).length,
    }
  }
  export() {
    return {
      format: 'dynamic-flashcards',
      version: 1,
      concepts: this.db.select().from(concepts).all(),
      edges: this.db.select().from(edges).all(),
      variants: this.db.select().from(variants).all(),
      reviews: this.db.select().from(reviews).all(),
    }
  }
}
