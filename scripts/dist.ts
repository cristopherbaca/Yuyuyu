import { spawnSync } from 'node:child_process'
import { resolve, join } from 'node:path'
const cache = process.env.XDG_CACHE_HOME ?? resolve('.onboarding/cache')
const result = spawnSync(
  process.execPath,
  ['node_modules/electron-builder/out/cli/cli.js', ...process.argv.slice(2)],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      XDG_CACHE_HOME: cache,
      ELECTRON_BUILDER_CACHE: process.env.ELECTRON_BUILDER_CACHE ?? join(cache, 'electron-builder'),
      ELECTRON_GET_USE_PROXY:
        process.env.ELECTRON_GET_USE_PROXY ?? (process.env.HTTPS_PROXY ? 'true' : ''),
    },
  },
)
process.exit(result.status ?? 1)
