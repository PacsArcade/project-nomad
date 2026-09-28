import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import StaticMiddleware from '@adonisjs/static/static_middleware'
import { AssetsConfig } from '@adonisjs/static/types'

/**
 * See #providers/assistant_static_provider.ts for why this exists — the same
 * reason maps_static_middleware.ts does, for the assistant avatar instead of
 * map region files.
 */
export default class AssistantStaticMiddleware {
  constructor(
    private path: string,
    private config: AssetsConfig
  ) {}

  async handle(ctx: HttpContext, next: NextFn) {
    const staticMiddleware = new StaticMiddleware(this.path, this.config)
    return staticMiddleware.handle(ctx, next)
  }
}
