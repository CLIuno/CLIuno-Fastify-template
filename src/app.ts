import 'reflect-metadata'
import cors from '@fastify/cors'
import dotenv from 'dotenv'
import Fastify from 'fastify'

import { db } from './db'
import authRoutes from './routes/auth.routes'
import followRoutes from './routes/follows.routes'
import postRoutes from './routes/posts.routes'
import roleRoutes from './routes/roles.routes'
import todoRoutes from './routes/todos.routes'
import userRoutes from './routes/users.routes'

dotenv.config()

const PORT = Number(process.env.PORT || 3000)
const API_VERSION = process.env.API_VERSION || 'v1'

async function main() {
    await db.initialize()

    const app = Fastify({ logger: process.env.NODE_ENV !== 'test' })
    await app.register(cors, { origin: true })

    // Clients send Content-Type: application/json even on bodyless requests
    // (logout, follow, deletes) — treat an empty body as an empty object.
    app.addContentTypeParser('application/json', { parseAs: 'string' }, (_request, body, done) => {
        if (body === '' || body === undefined) {
            done(null, {})
            return
        }
        try {
            done(null, JSON.parse(body as string))
        } catch (error) {
            done(error as Error)
        }
    })

    const prefix = `/api/${API_VERSION}`
    await app.register(authRoutes, { prefix: `${prefix}/auth` })
    await app.register(userRoutes, { prefix: `${prefix}/users` })
    await app.register(todoRoutes, { prefix: `${prefix}/todos` })
    await app.register(postRoutes, { prefix: `${prefix}/posts` })
    await app.register(followRoutes, { prefix: `${prefix}/follows` })
    await app.register(roleRoutes, { prefix: `${prefix}/roles` })

    app.get('/', async () => ({ status: 'success', message: 'CLIuno Fastify API' }))

    await app.listen({ port: PORT, host: '0.0.0.0' })
}

main().catch((error) => {
    console.error(error)
    process.exit(1)
})