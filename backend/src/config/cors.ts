import type { FastifyCorsOptions } from '@fastify/cors'
import type { Config } from './index.js'

export function getCorsConfig(config: Config): FastifyCorsOptions {
  return {
    origin:
      config.NODE_ENV === 'production'
        ? ['https://usenuroo.com']
        : [
            'http://localhost:3000',
            'http://localhost:3101',
            'http://127.0.0.1:3000',
            'http://127.0.0.1:3101',
          ],
    credentials: true,
  }
}
