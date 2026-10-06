import { checkNativeBinding } from './native.ts'
import { spawnSync } from 'node:child_process'
if (checkNativeBinding()) {
  console.log('SQLite native binding verified under Electron.')
  process.exit(0)
}
const result = spawnSync(
  process.execPath,
  ['node_modules/electron-builder/out/cli/cli.js', 'install-app-deps'],
  { stdio: 'inherit' },
)
process.exit(result.status ?? 1)
