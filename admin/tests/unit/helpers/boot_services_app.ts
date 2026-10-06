import { AppFactory } from '@adonisjs/core/factories/app'
import { setApp } from '@adonisjs/core/services/app'
import { LoggerFactory } from '@adonisjs/logger/factories'

let booted = false

/**
 * Minimal app boot for unit specs that import services touching the
 * `@adonisjs/core/services/logger` singleton. That module top-level-awaits
 * `app.booted(...)`, which throws when no app exists (plain `node --test`,
 * no ace runner). Call this with a top-level `await` in the spec BEFORE
 * dynamic-importing any service module. No providers, no DB, no HTTP:
 * enough for pure decision/parsing code paths only.
 */
export async function bootServicesApp(): Promise<void> {
  if (booted) return
  const app = new AppFactory().create(new URL('../../', import.meta.url), () => {})
  await app.init()
  app.container.bindValue('logger', new LoggerFactory().create())
  setApp(app)
  await app.boot()
  booted = true
}
