import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import initialMigration from './migrations/0001.sql?raw'
import * as schema from './schema'
export function createDatabase(path = ':memory:') {
  const sqlite = new Database(path)
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')
  sqlite.pragma('busy_timeout = 5000')
  sqlite.exec('CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY)')
  const applied = sqlite.prepare('SELECT version FROM schema_migrations WHERE version = 1').get()
  if (!applied) sqlite.transaction(() => { sqlite.exec(initialMigration); sqlite.prepare('INSERT INTO schema_migrations VALUES (1)').run() })()
  return { db: drizzle(sqlite, { schema }), close: () => sqlite.close() }
}
export type Db = ReturnType<typeof createDatabase>['db']
