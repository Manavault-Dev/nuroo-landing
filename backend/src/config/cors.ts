import type { FastifyCorsOptions } from '@fastify/cors'
import type { Config } from './index.js'

export function getCorsConfig(config: Config): FastifyCorsOptions {
  return {
    origin: config.NODE_ENV === 'production'
      ? ['https://usenuroo.com']
      : ['http://localhost:3000', 'http://localhost:3001'],
    credentials: true,
  }
}
