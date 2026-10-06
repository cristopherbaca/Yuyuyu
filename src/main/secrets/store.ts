import { safeStorage } from 'electron'
import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs'
import type { SecretStore } from '../services/settings'
export class ElectronSecrets implements SecretStore {
  constructor(private path: string, private envKey: string | null = null) {}
  private secure() { return safeStorage.isEncryptionAvailable() && (process.platform !== 'linux' || safeStorage.getSelectedStorageBackend() !== 'basic_text') }
  warning() { return this.secure() ? null : 'El cifrado del sistema no está disponible. La clave se guarda localmente sin cifrar (permisos privados). Configura un llavero seguro.' }
  has() { return existsSync(this.path) || Boolean(this.envKey) }
  get() {
    if (!existsSync(this.path)) return this.envKey
    const data = readFileSync(this.path)
    if (data.subarray(0, 4).toString() === 'RAW:') return data.subarray(4).toString('utf8')
    if (!this.secure()) throw new Error('El llavero del sistema no está disponible para descifrar la clave.')
    return safeStorage.decryptString(data)
  }
  set(key: string) {
    this.envKey = null
    if (!key) { if (existsSync(this.path)) unlinkSync(this.path); return }
    const data = this.secure() ? safeStorage.encryptString(key) : Buffer.from(`RAW:${key}`)
    writeFileSync(this.path, data, { mode: 0o600 })
  }
}
