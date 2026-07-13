import type { FastifyInstance } from 'fastify'

import { adminOnly, authenticate, safeUser } from '../auth'
import { db } from '../db'
import { Post, User } from '../entities'

export default async function userRoutes(app: FastifyInstance) {
    const users = () => db.getRepository(User)
    app.addHook('preHandler', authenticate)

    app.get('/', async (_request, reply) => {
        const all = await users().find({ relations: ['role'] })
        return reply.send({ status: 'success', data: { users: all.map(safeUser) } })
    })

    app.get('/current', async (request, reply) => {
        const user = await users().findOne({ where: { id: request.user.id }, relations: ['role'] })
        if (!user) {
            return reply.status(404).send({ status: 'warning', message: 'User not found' })
        }
        return reply.send({ status: 'success', data: { user: safeUser(user) } })
    })

    app.patch('/current', async (request, reply) => {
        const user = await users().findOneBy({ id: request.user.id })
        if (!user) {
            return reply.status(404).send({ status: 'warning', message: 'User not found' })
        }
        const { first_name, last_name, phone } = (request.body ?? {}) as Partial<User>
        if (first_name !== undefined) user.first_name = first_name
        if (last_name !== undefined) user.last_name = last_name
        if (phone !== undefined) user.phone = phone
        await users().save(user)
        return reply.send({
            status: 'success',
            message: 'User updated',
            data: { user: safeUser(user) },
        })
    })

    app.delete('/current', async (request, reply) => {
        const user = await users().findOneBy({ id: request.user.id })
        if (!user) {
            return reply.status(404).send({ status: 'warning', message: 'User not found' })
        }
        user.is_deleted = true
        await users().save(user)
        return reply.send({
            status: 'success',
            message: 'User deleted',
            data: { user: safeUser(user) },
        })
    })

    app.get('/username/:username', async (request, reply) => {
        const { username } = request.params as { username: string }
        const user = await users().findOneBy({ username })
        if (!user) {
            return reply.status(404).send({ status: 'warning', message: 'User not found' })
        }
        return reply.send({ status: 'success', data: { user: safeUser(user) } })
    })

    app.get('/:id', async (request, reply) => {
        const { id } = request.params as { id: string }
        const user = await users().findOneBy({ id })
        if (!user) {
            return reply.status(404).send({ status: 'warning', message: 'User not found' })
        }
        return reply.send({ status: 'success', data: { user: safeUser(user) } })
    })

    app.get('/:id/posts', async (request, reply) => {
        const { id } = request.params as { id: string }
        const user = await users().findOneBy({ id })
        if (!user) {
            return reply.status(404).send({ status: 'warning', message: 'User not found' })
        }
        const posts = await db.getRepository(Post).find({
            where: { user: { id } },
            relations: ['user', 'comments', 'comments.user'],
            order: { createdAt: 'DESC' },
        })
        return reply.send({ status: 'success', message: 'Posts', data: { posts } })
    })

    app.get('/:id/roles', async (request, reply) => {
        const { id } = request.params as { id: string }
        const user = await users().findOne({ where: { id }, relations: ['role'] })
        if (!user) {
            return reply.status(404).send({ status: 'warning', message: 'User not found' })
        }
        return reply.send({ status: 'success', message: 'Role found', data: { role: user.role } })
    })

    app.patch('/:id', { preHandler: adminOnly }, async (request, reply) => {
        const { id } = request.params as { id: string }
        const user = await users().findOneBy({ id })
        if (!user) {
            return reply.status(404).send({ status: 'warning', message: 'User not found' })
        }
        const { first_name, last_name, phone } = (request.body ?? {}) as Partial<User>
        if (first_name !== undefined) user.first_name = first_name
        if (last_name !== undefined) user.last_name = last_name
        if (phone !== undefined) user.phone = phone
        await users().save(user)
        return reply.send({ status: 'success', data: { user: safeUser(user) } })
    })

    app.delete('/:id', { preHandler: adminOnly }, async (request, reply) => {
        const { id } = request.params as { id: string }
        const user = await users().findOneBy({ id })
        if (!user) {
            return reply.status(404).send({ status: 'warning', message: 'User not found' })
        }
        user.is_deleted = true
        await users().save(user)
        return reply.send({ status: 'success', data: { user: safeUser(user) } })
    })
}