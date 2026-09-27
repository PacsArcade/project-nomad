import AssistantStaticMiddleware from '#middleware/assistant_static_middleware'
import logger from '@adonisjs/core/services/logger'
import type { ApplicationService } from '@adonisjs/core/types'
import { defineConfig } from '@adonisjs/static'
import { join } from 'path'

/**
 * Serves the uploaded assistant-avatar image from the persisted storage
 * volume (storage/assistant), the same way MapStaticProvider serves
 * storage/maps — see that file for why a dedicated provider/middleware pair
 * is needed instead of the default static middleware, which only serves
 * public/ (which is baked into the container image and does not survive an
 * update, unlike the storage/ bind mount).
 */
export default class AssistantStaticProvider {
  constructor(protected app: ApplicationService) {}
  register() {
    this.app.container.singleton(AssistantStaticMiddleware, () => {
      const path = join(process.cwd(), '/storage/assistant')
      logger.info(`Assistant avatar files will be served from ${path}`)
      const config = this.app.config.get<any>('static', defineConfig({}))
      return new AssistantStaticMiddleware(path, config)
    })
  }
}
