import type { FastifyInstance } from 'fastify'

import { authenticate, safeUser } from '../auth'
import { db } from '../db'
import { Follow, User } from '../entities'

export default async function followRoutes(app: FastifyInstance) {
    const follows = () => db.getRepository(Follow)
    const users = () => db.getRepository(User)
    app.addHook('preHandler', authenticate)

    const targetOf = async (request: { params: unknown }) => {
        const { userId } = request.params as { userId: string }
        return users().findOneBy({ id: userId })
    }

    app.post('/:userId/follow', async (request, reply) => {
        const target = await targetOf(request)
        if (!target) {
            return reply.status(404).send({ status: 'error', message: 'User not found' })
        }
        const me = await users().findOneBy({ id: request.user.id })
        if (!me || me.id === target.id) {
            return reply.status(400).send({ status: 'error', message: 'Cannot follow this user' })
        }

        const existing = await follows().findOne({
            where: { follower: { id: me.id }, following: { id: target.id } },
        })
        if (!existing) {
            await follows().save(follows().create({ follower: me, following: target }))
        }
        return reply.status(201).send({ status: 'success', message: 'Followed successfully' })
    })

    app.delete('/:userId/follow', async (request, reply) => {
        const target = await targetOf(request)
        if (!target) {
            return reply.status(404).send({ status: 'error', message: 'User not found' })
        }
        const existing = await follows().findOne({
            where: { follower: { id: request.user.id }, following: { id: target.id } },
        })
        if (existing) await follows().remove(existing)
        return reply.send({ status: 'success', message: 'Unfollowed successfully' })
    })

    app.get('/:userId/followers', async (request, reply) => {
        const target = await targetOf(request)
        if (!target) {
            return reply.status(404).send({ status: 'error', message: 'User not found' })
        }
        const list = await follows().find({
            where: { following: { id: target.id } },
            relations: ['follower'],
        })
        return reply.send({
            status: 'success',
            data: { followers: list.map((f) => safeUser(f.follower)) },
        })
    })

    app.get('/:userId/following', async (request, reply) => {
        const target = await targetOf(request)
        if (!target) {
            return reply.status(404).send({ status: 'error', message: 'User not found' })
        }
        const list = await follows().find({
            where: { follower: { id: target.id } },
            relations: ['following'],
        })
        return reply.send({
            status: 'success',
            data: { following: list.map((f) => safeUser(f.following)) },
        })
    })

    app.get('/:userId/is-following', async (request, reply) => {
        const target = await targetOf(request)
        if (!target) {
            return reply.status(404).send({ status: 'error', message: 'User not found' })
        }
        const existing = await follows().findOne({
            where: { follower: { id: request.user.id }, following: { id: target.id } },
        })
        return reply.send({ status: 'success', data: { isFollowing: !!existing } })
    })
}