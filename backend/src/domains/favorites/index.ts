import type { FastifyPluginAsync } from 'fastify'
import { favoritesRoute } from './favorites.routes.js'

export const favoritesDomain: FastifyPluginAsync = async (fastify) => {
  await fastify.register(favoritesRoute)
}
