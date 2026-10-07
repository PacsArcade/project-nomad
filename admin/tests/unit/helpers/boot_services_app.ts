import 'reflect-metadata'
import { AppFactory } from '@adonisjs/core/factories/app'
import { setApp } from '@adonisjs/core/services/app'
import { LoggerFactory } from '@adonisjs/logger/factories'
import { Database } from '@adonisjs/lucid/database'

let booted = false

/**
 * Minimal app boot for unit specs that import services touching the
 * `@adonisjs/core/services/logger` singleton. That module top-level-awaits
 * `app.booted(...)`, which throws when no app exists (plain `node --test`,
 * no ace runner). Call this with a top-level `await` in the spec BEFORE
 * dynamic-importing any service module. No providers, no DB, no HTTP:
 * enough for pure decision/parsing code paths only.
 *
 * Two more container stubs cover the other service singletons that resolve
 * bindings right after boot: transmit (broadcast no-op) and the Lucid
 * Database class (empty object; bound by class because the db service
 * module resolves `container.make(Database)`). Specs using this helper
 * must never broadcast or query.
 */
export async function bootServicesApp(): Promise<void> {
  if (booted) return
  // `#start/env` validates process.env at module scope; under plain
  // `node --test` there is no .env loader, so supply harmless test
  // defaults (only for variables the caller has not set).
  const envDefaults: Record<string, string> = {
    NODE_ENV: 'test',
    PORT: '3333',
    APP_KEY: 'unit-test-app-key-not-a-secret',
    HOST: 'localhost',
    URL: 'http://localhost:3333',
    LOG_LEVEL: 'warn',
    DB_HOST: 'localhost',
    DB_PORT: '3306',
    DB_USER: 'nomad',
    DB_DATABASE: 'nomad_unit_test',
    REDIS_HOST: 'localhost',
    REDIS_PORT: '6379',
  }
  for (const [key, value] of Object.entries(envDefaults)) {
    process.env[key] ??= value
  }
  const app = new AppFactory().create(new URL('../../', import.meta.url), () => {})
  await app.init()
  app.container.bindValue('logger', new LoggerFactory().create())
  app.container.bindValue('transmit', { broadcast: () => {} })
  app.container.bindValue(Database, {} as Database)
  setApp(app as any)
  await app.boot()
  booted = true
}
