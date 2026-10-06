import { and, asc, desc, eq } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { generationSchema } from '../../shared/domain'
import type { Db } from '../db/client'
import { concepts, reviews, variants } from '../db/schema'
import type { Llm } from '../llm/types'
import type { Settings } from '../../shared/domain'
import type { FsrsService } from './fsrs'
import { calibrate } from './difficulty'
import { VerificationService } from './verification'
import { normalize } from './grading'
interface RefillJob {
  id: string
  extra?: number
  priority: boolean
  resolve: () => void
  reject: (error: unknown) => void
}
export class GenerationService {
  private running = new Map<string, Promise<void>>()
  private queued: RefillJob[] = []
  private active = 0
  constructor(
    private db: Db,
    private llm: Llm,
    private fsrs: FsrsService,
    private settings: () => Settings,
    private clock: () => Date,
    private updated: (id: string) => void,
    private log: (message: string) => void = (message) => console.info(message),
  ) {}
  refillConcept(id: string, extra?: number, priority = false): Promise<void> {
    const existing = this.running.get(id)
    if (existing) {
      const queued = this.queued.find((job) => job.id === id)
      if (queued) {
        queued.priority ||= priority
        if (extra !== undefined) queued.extra = extra
        return existing
      }
      return existing.then(() => this.refillConcept(id, extra, priority))
    }
    let resolve!: () => void
    let reject!: (error: unknown) => void
    const task = new Promise<void>((done, fail) => {
      resolve = done
      reject = fail
    })
    this.running.set(id, task)
    this.queued.push({ id, extra, priority, resolve, reject })
    this.pump()
    return task
  }
  private pump() {
    while (this.active < 2 && this.queued.length) {
      const priority = this.queued.findIndex((job) => job.priority)
      const job = this.queued.splice(priority < 0 ? 0 : priority, 1)[0]!
      this.active++
      const finish = (error?: unknown) => {
        this.running.delete(job.id)
        this.active--
        if (error !== undefined) job.reject(error)
        else job.resolve()
        queueMicrotask(() => this.pump())
      }
      void this.refill(job.id, job.extra).then(
        () => finish(),
        (error) => finish(error),
      )
    }
  }
  async refillAll() {
    const all = this.db
      .select({ id: concepts.id })
      .from(concepts)
      .where(eq(concepts.archived, false))
      .orderBy(asc(concepts.due))
      .all()
    await Promise.all(all.map((concept) => this.refillConcept(concept.id)))
  }
  private async refill(id: string, extra?: number) {
    if (!this.llm.available()) return
    const concept = this.db.select().from(concepts).where(eq(concepts.id, id)).get()
    if (!concept || concept.archived) return
    const pool = this.db.select().from(variants).where(eq(variants.conceptId, id)).all()
    const unused = pool.filter((v) => v.status === 'verified' && v.timesShown === 0).length
    const slots = extra ?? Math.max(0, this.settings().targetPoolSize - unused)
    if (!slots) return
    const errors = this.db
      .select({ error: reviews.errorSummary })
      .from(reviews)
      .where(eq(reviews.conceptId, id))
      .orderBy(desc(reviews.reviewedAt))
      .limit(5)
      .all()
      .flatMap((r) => (r.error ? [r.error] : []))
    const target = calibrate(
      {
        state: concept.state,
        stability: concept.stability,
        retrievability: this.fsrs.retrievability(this.fsrs.deserialize(concept.fsrsCardJson)),
      },
      concept.modePref,
      'deep',
      errors,
    )
    const questions = pool.map((v) => v.questionMd)
    const verifier = new VerificationService(this.llm)
    for (let slot = 0; slot < slots; slot++) {
      let filled = false
      for (let attempt = 0; attempt < 3; attempt++) {
        // Spread the pool across types, including application items for new notes that support them.
        const currentPool = this.db.select().from(variants).where(eq(variants.conceptId, id)).all()
        const readyCount = (type: (typeof target.allowedTypes)[number]) =>
          currentPool.filter(
            (v) => v.type === type && v.status === 'verified' && v.timesShown === 0,
          ).length
        const historyCount = (type: (typeof target.allowedTypes)[number]) =>
          currentPool.filter((v) => v.type === type).length
        const ranked = [...target.allowedTypes].sort(
          (a, b) =>
            readyCount(a) - readyCount(b) ||
            (errors.length
              ? Number(!target.preferredTypes.includes(a)) -
                Number(!target.preferredTypes.includes(b))
              : 0) ||
            historyCount(a) - historyCount(b),
        )
        const type = ranked[attempt % ranked.length]!
        try {
          const generated = await this.llm.complete(
            {
              purpose: 'generate',
              input: {
                conceptId: id,
                title: concept.title,
                noteText: concept.noteText,
                targetType: type,
                bloomLevel: target.bloomLevel,
                difficulty: Math.max(1, Math.min(5, target.difficulty + (slot % 2))),
                recentErrors: errors,
                nextAngleHint: concept.nextAngleHint,
                existingQuestions: questions,
              },
            },
            generationSchema,
          )
          if (generated.unsupported || !generated.variant) continue
          const variant = generated.variant
          const current = this.db.select().from(concepts).where(eq(concepts.id, id)).get()
          if (
            !current ||
            current.noteText !== concept.noteText ||
            current.modePref !== concept.modePref ||
            current.fsrsCardJson !== concept.fsrsCardJson ||
            current.nextAngleHint !== concept.nextAngleHint
          )
            return
          let report =
            variant.type === type
              ? await verifier.verify(variant, concept.noteText)
              : { consistent: false, issues: ['El tipo generado no es el solicitado.'] }
          if (questions.some((question) => normalize(question) === normalize(variant.questionMd)))
            report = { consistent: false, issues: [...report.issues, 'Pregunta duplicada.'] }
          // A note can be edited/deleted while verification is in flight.
          const latest = this.db.select().from(concepts).where(eq(concepts.id, id)).get()
          if (
            !latest ||
            latest.noteText !== concept.noteText ||
            latest.modePref !== concept.modePref ||
            latest.fsrsCardJson !== concept.fsrsCardJson ||
            latest.nextAngleHint !== concept.nextAngleHint
          )
            return
          this.db
            .insert(variants)
            .values({
              id: randomUUID(),
              conceptId: id,
              ...variant,
              status: report.consistent ? 'verified' : 'rejected',
              verificationReport: report,
              createdAt: this.clock().getTime(),
            })
            .run()
          questions.push(variant.questionMd)
          this.updated(id)
          if (report.consistent) {
            filled = true
            break
          }
        } catch {
          this.log(`No se pudo rellenar el banco del concepto ${id}; se conserva el banco local.`)
          return
        }
      }
      if (!filled) this.log(`Se agotaron los intentos para una variante del concepto ${id}.`)
    }
    this.updated(id)
  }
  retireForConcept(id: string, unusedOnly = false) {
    this.db
      .update(variants)
      .set({ status: 'retired' })
      .where(
        and(
          eq(variants.conceptId, id),
          eq(variants.status, 'verified'),
          unusedOnly ? eq(variants.timesShown, 0) : undefined,
        ),
      )
      .run()
    this.updated(id)
  }
}
