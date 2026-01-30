import { buildApp } from './app.js'
import { config } from './config/index.js'

async function start() {
  try {
    const server = await buildApp()
    const port = parseInt(config.PORT, 10)
    const host = config.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1'

    await server.listen({ port, host })
    console.log(`Server running at http://${host}:${port}`)
  } catch (error) {
    console.error('Failed to start server:', error)
    process.exit(1)
  }
}

start()
