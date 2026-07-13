import type { FastifyInstance } from 'fastify'

import { adminOnly, authenticate } from '../auth'
import { db } from '../db'
import { Role } from '../entities'

export default async function roleRoutes(app: FastifyInstance) {
    const roles = () => db.getRepository(Role)
    app.addHook('preHandler', authenticate)
    app.addHook('preHandler', adminOnly)

    app.get('/', async (_request, reply) => {
        const all = await roles().find()
        return reply.send({ status: 'success', data: { roles: all } })
    })

    app.get('/:id', async (request, reply) => {
        const { id } = request.params as { id: string }
        const role = await roles().findOneBy({ id })
        if (!role) {
            return reply.status(404).send({ status: 'warning', message: 'Role not found' })
        }
        return reply.send({ status: 'success', data: { role } })
    })

    app.post('/', async (request, reply) => {
        const { name } = (request.body ?? {}) as { name?: string }
        if (!name) {
            return reply.status(400).send({ status: 'warning', message: 'Role name is required' })
        }
        const existing = await roles().findOneBy({ name })
        if (existing) {
            return reply.status(400).send({ status: 'warning', message: 'Role already exists' })
        }
        const role = await roles().save(roles().create({ name }))
        return reply
            .status(201)
            .send({ status: 'success', message: 'Role created successfully', data: { role } })
    })

    app.patch('/:id', async (request, reply) => {
        const { id } = request.params as { id: string }
        const role = await roles().findOneBy({ id })
        if (!role) {
            return reply.status(404).send({ status: 'warning', message: 'Role not found' })
        }
        const { name } = (request.body ?? {}) as { name?: string }
        if (name !== undefined) role.name = name
        await roles().save(role)
        return reply.send({ status: 'success', message: 'Role updated', data: { role } })
    })

    app.delete('/:id', async (request, reply) => {
        const { id } = request.params as { id: string }
        const role = await roles().findOneBy({ id })
        if (!role) {
            return reply.status(404).send({ status: 'warning', message: 'Role not found' })
        }
        await roles().remove(role)
        return reply.send({ status: 'success', message: 'Role deleted successfully' })
    })
}