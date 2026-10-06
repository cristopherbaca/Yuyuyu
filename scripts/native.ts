import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
export function checkNativeBinding(): boolean {
  // better-sqlite3 13 ships Node-API prebuilds: verify on the actual Electron runtime.
  const electron: string = require('electron')
  const script = `const Database = require(${JSON.stringify(require.resolve('better-sqlite3'))}); const db = new Database(':memory:'); if (db.prepare('SELECT 1 AS value').get().value !== 1) process.exit(1); db.close();`
  const result = spawnSync(electron, ['-e', script], {
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
    encoding: 'utf8',
  })
  return result.status === 0
}
export default function beforeBuild(context?: {
  arch: string
  platform: { name: string }
}): boolean {
  if (context && (context.arch !== process.arch || context.platform.name !== process.platform))
    return true
  const prebuild = join(
    'node_modules/better-sqlite3/prebuilds',
    `${process.platform}-${process.arch}.node`,
  )
  if (existsSync(prebuild) && checkNativeBinding()) {
    console.log('Verified better-sqlite3 Node-API prebuild under Electron; no ABI rebuild needed.')
    return false
  }
  return true
}
