import { describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { createDatabase } from '../src/main/db/client'
import { concepts, variants } from '../src/main/db/schema'
import { FakeLlm } from '../src/main/llm/fake'
import { groundingScore } from '../src/main/services/verification'
import { GenerationService } from '../src/main/services/generation'
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
describe('verification gate', () => {
  it('accepts real and fuzzy quotes, rejects fabricated grounding', () => {
    expect(groundingScore('los catetos a y b', 'Aquí los catetos a y b son conocidos.')).toBe(100)
    expect(groundingScore('los catetos a y c', 'Aquí los catetos a y b son conocidos.')).toBeGreaterThan(90)
    expect(groundingScore('El Sol es de queso', 'Los catetos a y b son conocidos.')).toBeLessThan(90)
  })
  it('stores consistent variants as verified', async () => {
    const f = fixture(); const id = f.concept()
    const generation = new GenerationService(f.db, new FakeLlm(), f.fsrs, () => f.settings, f.clock, () => {})
    await generation.refillConcept(id)
    const pool = f.db.select().from(variants).all()
    expect(pool.filter(v => v.status === 'verified')).toHaveLength(5)
    expect(pool.every(v => v.verificationReport.consistent)).toBe(true)
    await generation.refillConcept(id)
    expect(f.db.select().from(variants).all()).toHaveLength(5)
    f.close()
  })
  it('records inconsistent rejections and stops unsupported slots', async () => {
    const f = fixture(); const id = f.concept()
    const generation = new GenerationService(f.db, new FakeLlm('hallucinated'), f.fsrs, () => f.settings, f.clock, () => {})
    await generation.refillConcept(id, 1)
    expect(f.db.select().from(variants).all().every(v => v.status === 'rejected')).toBe(true)
    expect(f.db.select().from(variants).all()).toHaveLength(3)
    const second = f.concept('Sin datos', 'Una nota breve')
    await new GenerationService(f.db, new FakeLlm('unsupported'), f.fsrs, () => f.settings, f.clock, () => {}).refillConcept(second)
    expect(f.db.select().from(variants).all()).toHaveLength(3)
    f.close()
  })
})
