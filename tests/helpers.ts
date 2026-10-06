import { randomUUID } from 'node:crypto'
import { createDatabase } from '../src/main/db/client'
import { concepts } from '../src/main/db/schema'
import { FsrsService } from '../src/main/services/fsrs'
import { settingsSchema } from '../src/shared/domain'
export function fixture() {
  const connection = createDatabase()
  const clock = () => new Date('2026-10-05T10:00:00Z')
  const fsrs = new FsrsService(() => 0.9, clock)
  const settings = settingsSchema.parse({ fakeLlm: true })
  function concept(title = 'Teorema de Pitágoras', noteText = 'En un triángulo rectángulo, los catetos a y b y la hipotenusa c cumplen a² + b² = c².', modePref: 'both' | 'simple' | 'problem' = 'both') {
    const id = randomUUID()
    connection.db.insert(concepts).values({ id, title, noteText, modePref, ...fsrs.columns(fsrs.create()), createdAt: clock().getTime() }).run()
    return id
  }
  return { ...connection, clock, fsrs, settings, concept }
}
