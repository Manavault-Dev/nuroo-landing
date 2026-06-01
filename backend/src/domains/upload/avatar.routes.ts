import { FastifyPluginAsync } from 'fastify'
import multipart from '@fastify/multipart'
import { getStorageBucket } from '../../infrastructure/database/firebase.js'

export const avatarUploadRoute: FastifyPluginAsync = async (fastify) => {
  await fastify.register(multipart, {
    limits: {
      fileSize: 5 * 1024 * 1024,
    },
  })

  fastify.post('/api/v1/upload/avatar', async (request, reply) => {
    try {
      const parts = request.parts()
      let fileBuffer: Buffer | null = null
      let fileMimetype = ''
      let fileFilename = 'avatar.jpg'

      for await (const part of parts) {
        if (part.type === 'file' && part.fieldname === 'file') {
          if (!part.mimetype.startsWith('image/')) {
            return reply.code(400).send({ error: 'Only image files are allowed' })
          }

          const chunks: Buffer[] = []
          for await (const chunk of part.file) {
            chunks.push(chunk)
          }
          fileBuffer = Buffer.concat(chunks)
          fileMimetype = part.mimetype || ''
          fileFilename = part.filename || 'avatar.jpg'
        }
      }

      if (!fileBuffer || fileBuffer.length === 0) {
        return reply.code(400).send({ error: 'File is required' })
      }

      const userId = (request as any).user?.uid
      if (!userId) {
        return reply.code(401).send({ error: 'Unauthorized' })
      }

      const bucket = await getStorageBucket()
      const safeName = fileFilename.replace(/[^a-zA-Z0-9._-]/g, '_')
      const storagePath = `avatars/${userId}/${Date.now()}-${safeName}`

      const file = bucket.file(storagePath)
      await file.save(fileBuffer, {
        contentType: fileMimetype || undefined,
        metadata: { cacheControl: 'public, max-age=31536000' },
      })

      await file.makePublic()
      const publicUrl = `https://storage.googleapis.com/${bucket.name}/${storagePath}`

      return reply.code(200).send({ url: publicUrl })
    } catch (error: unknown) {
      fastify.log.error({ err: error }, 'Avatar upload failed')
      return reply.code(500).send({
        error: 'Upload failed',
        details: error instanceof Error ? error.message : '',
      })
    }
  })
}
