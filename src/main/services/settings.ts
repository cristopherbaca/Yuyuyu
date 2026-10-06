import { existsSync, readFileSync, mkdirSync, writeFileSync, renameSync } from 'node:fs'
import { dirname } from 'node:path'
import { settingsSchema, type Settings } from '../../shared/domain'
export interface SecretStore { has(): boolean; get(): string | null; set(key: string): void; warning(): string | null }
export class SettingsService {
  private value: Settings
  constructor(private path: string | null, private secret: SecretStore, defaults: Partial<Settings> = {}) {
    this.value = settingsSchema.parse(defaults)
    if (path && existsSync(path)) this.value = settingsSchema.parse(JSON.parse(readFileSync(path, 'utf8')) as unknown)
  }
  get(): Settings { return { ...this.value } }
  publicGet() { return { ...this.get(), apiKeySet: this.secret.has(), secretWarning: this.secret.warning() } }
  set(partial: Partial<Settings>) {
    const value = settingsSchema.parse({ ...this.value, ...partial })
    if (this.path) { mkdirSync(dirname(this.path), { recursive: true }); writeFileSync(`${this.path}.tmp`, JSON.stringify(value, null, 2), { mode: 0o600 }); renameSync(`${this.path}.tmp`, this.path) }
    this.value = value
    return this.publicGet()
  }
  setApiKey(key: string) { this.secret.set(key); return this.publicGet() }
  apiKey() { return this.secret.get() }
}
