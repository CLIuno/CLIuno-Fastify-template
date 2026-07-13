import type { FastifyInstance } from 'fastify'

import { authenticate } from '../auth'
import { db } from '../db'
import { Todo, User } from '../entities'

export default async function todoRoutes(app: FastifyInstance) {
    const todos = () => db.getRepository(Todo)
    app.addHook('preHandler', authenticate)

    app.get('/', async (_request, reply) => {
        const all = await todos().find({ relations: ['user'], order: { createdAt: 'DESC' } })
        return reply.send({ status: 'success', data: { todos: all } })
    })

    app.get('/current-user', async (request, reply) => {
        const mine = await todos().find({
            where: { user: { id: request.user.id } },
            relations: ['user'],
            order: { createdAt: 'DESC' },
        })
        return reply.send({ status: 'success', data: { todos: mine } })
    })

    app.post('/', async (request, reply) => {
        const { title, description } = (request.body ?? {}) as {
            title?: string
            description?: string
        }
        if (!title) {
            return reply.status(400).send({ status: 'error', message: 'Title is required' })
        }
        const user = await db.getRepository(User).findOneBy({ id: request.user.id })
        if (!user) {
            return reply.status(404).send({ status: 'error', message: 'User not found' })
        }

        const todo = todos().create({ title, description: description || '', user })
        const saved = await todos().save(todo)
        return reply.status(201).send({
            status: 'success',
            message: 'Todo created successfully',
            data: { todo: saved },
        })
    })

    app.get('/:id', async (request, reply) => {
        const { id } = request.params as { id: string }
        const todo = await todos().findOne({ where: { id }, relations: ['user'] })
        if (!todo) {
            return reply.status(404).send({ status: 'error', message: 'Todo not found' })
        }
        return reply.send({ status: 'success', data: { todo } })
    })

    app.patch('/:id/toggle', async (request, reply) => {
        const { id } = request.params as { id: string }
        const todo = await todos().findOne({ where: { id }, relations: ['user'] })
        if (!todo) {
            return reply.status(404).send({ status: 'error', message: 'Todo not found' })
        }
        todo.is_completed = !todo.is_completed
        await todos().save(todo)
        return reply.send({ status: 'success', message: 'Todo toggled', data: { todo } })
    })

    app.patch('/:id', async (request, reply) => {
        const { id } = request.params as { id: string }
        const todo = await todos().findOne({ where: { id }, relations: ['user'] })
        if (!todo) {
            return reply.status(404).send({ status: 'error', message: 'Todo not found' })
        }
        const { title, description, is_completed } = (request.body ?? {}) as Partial<Todo>
        if (title !== undefined) todo.title = title
        if (description !== undefined) todo.description = description
        if (is_completed !== undefined) todo.is_completed = is_completed
        await todos().save(todo)
        return reply.send({ status: 'success', message: 'Todo updated', data: { todo } })
    })

    app.delete('/:id', async (request, reply) => {
        const { id } = request.params as { id: string }
        const todo = await todos().findOneBy({ id })
        if (!todo) {
            return reply.status(404).send({ status: 'error', message: 'Todo not found' })
        }
        await todos().remove(todo)
        return reply.send({ status: 'success', message: 'Todo deleted successfully' })
    })
}