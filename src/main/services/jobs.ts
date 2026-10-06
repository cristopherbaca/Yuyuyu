import type { GenerationService } from './generation'
export class JobService {
  private timer: ReturnType<typeof setInterval> | null = null
  private all: Promise<void> | null = null
  private rerun = false
  constructor(
    private generation: GenerationService,
    private log: (message: string) => void = () => {},
  ) {}
  start() {
    this.refillNow()
    this.timer = setInterval(() => this.refillNow(), 30 * 60 * 1000)
    this.timer.unref()
  }
  stop() {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
    this.rerun = false
  }
  refillNow() {
    if (this.all) this.rerun = true
    else
      this.all = this.generation
        .refillAll()
        .catch(() => this.log('No se pudo completar el relleno del banco.'))
        .finally(() => {
          this.all = null
          if (this.rerun) {
            this.rerun = false
            this.refillNow()
          }
        })
    return { queued: true }
  }
  concept(id: string, n?: number) {
    void this.generation.refillConcept(id, n).catch(() => this.log('No se pudo generar el banco.'))
    return { queued: true }
  }
  async drain() {
    while (this.all) await this.all
  }
}
