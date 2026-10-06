import { and, desc, eq, or } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import type { Db } from '../db/client'
import { concepts, edges, reviews, variants, type Concept } from '../db/schema'
import type { FsrsService } from './fsrs'
import type { GenerationService } from './generation'
import type { ConceptView, ConceptDetail, Mode } from '../../shared/domain'
export class ConceptService {
  constructor(private db: Db, private fsrs: FsrsService, private generation: GenerationService, private clock: () => Date, private onCreate: (id: string) => void) {}
  view(concept: Concept): ConceptView {
    const poolSize = this.db.select({ id: variants.id }).from(variants).where(and(eq(variants.conceptId, concept.id), eq(variants.status, 'verified'), eq(variants.timesShown, 0))).all().length
    return { id: concept.id, title: concept.title, noteText: concept.noteText, modePref: concept.modePref, due: concept.due, state: concept.state, stability: concept.stability, difficulty: concept.difficulty, lastReview: concept.lastReview, nextAngleHint: concept.nextAngleHint, retrievability: this.fsrs.retrievability(this.fsrs.deserialize(concept.fsrsCardJson)), poolSize }
  }
  list() { return this.db.select().from(concepts).where(eq(concepts.archived, false)).orderBy(desc(concepts.createdAt)).all().map(c => this.view(c)) }
  get(id: string): ConceptDetail {
    const concept = this.db.select().from(concepts).where(eq(concepts.id, id)).get()
    if (!concept) throw new Error('No se encontró el concepto.')
    const history = this.db.select().from(reviews).where(eq(reviews.conceptId, id)).orderBy(desc(reviews.reviewedAt)).limit(15).all()
    const pool = this.db.select().from(variants).where(eq(variants.conceptId, id)).all()
    return { concept: this.view(concept), edges: this.db.select().from(edges).where(or(eq(edges.fromId, id), eq(edges.toId, id))).all(), reviews: history.map(r => ({ id: r.id, variantId: r.variantId, verdict: r.verdict, rating: r.rating, reviewedAt: r.reviewedAt, errorSummary: r.errorSummary, graderReasoning: r.graderReasoning, userOverrideVerdict: r.userOverrideVerdict })), pool: { verified: pool.filter(v => v.status === 'verified' && v.timesShown === 0).length, rejected: pool.filter(v => v.status === 'rejected').length, retired: pool.filter(v => v.status === 'retired').length } }
  }
  create(input: { title: string; noteText: string; modePref?: Mode }) {
    const id = randomUUID()
    this.db.insert(concepts).values({ id, ...input, ...this.fsrs.columns(this.fsrs.create()), createdAt: this.clock().getTime() }).run()
    this.onCreate(id)
    void this.generation.refillConcept(id)
    return this.get(id).concept
  }
  update(id: string, changes: { noteText?: string; modePref?: Mode }) {
    const before = this.get(id).concept
    this.db.update(concepts).set({ ...changes, nextAngleHint: changes.noteText !== undefined ? null : undefined }).where(eq(concepts.id, id)).run()
    if (changes.noteText !== undefined && changes.noteText !== before.noteText || changes.modePref !== undefined && changes.modePref !== before.modePref) {
      this.generation.retireForConcept(id)
      // An in-flight old-note task is allowed to finish its stale check before refilling the new note.
      void this.generation.refillConcept(id).then(() => this.generation.refillConcept(id))
    }
    return this.get(id).concept
  }
  delete(id: string) { this.get(id); this.db.delete(concepts).where(eq(concepts.id, id)).run(); return null }
  edgeStatus(id: string, status: 'confirmed' | 'rejected') {
    const edge = this.db.select().from(edges).where(eq(edges.id, id)).get()
    if (!edge) throw new Error('No se encontró la relación.')
    this.db.update(edges).set({ status }).where(eq(edges.id, id)).run(); return null
  }
}
