import { randomUUID } from 'crypto'
import fs from 'fs'
import path from 'path'
import { pipeline } from 'stream/promises'

import type { FastifyInstance } from 'fastify'

import { authenticate } from '../auth'
import { ALLOWED_IMAGE_TYPES, ensureUploadDir, publicUploadUrl } from '../upload'

export default async function uploadRoutes(app: FastifyInstance) {
    app.addHook('preHandler', authenticate)

    // Stores the bytes and hands back a URL. Attaching it to a user or a post is the
    // caller's job (PATCH /users/current, POST /posts) — upload mutates nothing.
    app.post('/image', async (request, reply) => {
        const file = await request.file()
        if (!file) {
            return reply.status(400).send({ status: 'warning', message: 'No image file provided' })
        }

        const ext = ALLOWED_IMAGE_TYPES[file.mimetype]
        if (!ext) {
            return reply
                .status(400)
                .send({ status: 'error', message: `Unsupported image type: ${file.mimetype}` })
        }

        const filename = `${randomUUID()}${ext}`
        const target = path.join(ensureUploadDir(), filename)
        await pipeline(file.file, fs.createWriteStream(target))

        // The stream stops at the limit rather than throwing, so check the flag after.
        if (file.file.truncated) {
            await fs.promises.unlink(target).catch(() => {})
            return reply
                .status(413)
                .send({ status: 'error', message: 'Image exceeds the 5 MB limit' })
        }

        return reply.status(201).send({
            status: 'success',
            message: 'Image uploaded',
            data: { url: publicUploadUrl(request, filename), filename },
        })
    })
}