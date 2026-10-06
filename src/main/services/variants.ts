import { eq } from 'drizzle-orm'
import type { Db } from '../db/client'
import { variants } from '../db/schema'
export class VariantService {
  constructor(
    private db: Db,
    private updated: (id: string) => void,
    private refill: (id: string) => void,
  ) {}
  report(id: string) {
    const variant = this.db.select().from(variants).where(eq(variants.id, id)).get()
    if (!variant) throw new Error('No se encontró la variante.')
    const reportCount = variant.reportCount + 1
    const status = reportCount >= 2 ? ('retired' as const) : variant.status
    this.db.update(variants).set({ reportCount, status }).where(eq(variants.id, id)).run()
    this.updated(variant.conceptId)
    if (status === 'retired') this.refill(variant.conceptId)
    return { reportCount, status }
  }
}
