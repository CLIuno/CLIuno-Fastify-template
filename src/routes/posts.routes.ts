import type { FastifyInstance } from 'fastify'

import { authenticate } from '../auth'
import { db } from '../db'
import { Comment, Post, User } from '../entities'

export default async function postRoutes(app: FastifyInstance) {
    const posts = () => db.getRepository(Post)
    const comments = () => db.getRepository(Comment)
    app.addHook('preHandler', authenticate)

    app.get('/', async (_request, reply) => {
        const all = await posts().find({
            relations: ['user', 'comments', 'comments.user'],
            order: { createdAt: 'DESC' },
        })
        return reply.send({ status: 'success', data: { posts: all } })
    })

    app.get('/current-user', async (request, reply) => {
        const mine = await posts().find({
            where: { user: { id: request.user.id } },
            relations: ['user', 'comments', 'comments.user'],
            order: { createdAt: 'DESC' },
        })
        return reply.send({ status: 'success', data: { posts: mine } })
    })

    app.post('/', async (request, reply) => {
        const { title, content } = (request.body ?? {}) as { title?: string; content?: string }
        if (!title || !content) {
            return reply
                .status(400)
                .send({ status: 'error', message: 'Title and Content are required' })
        }
        const user = await db.getRepository(User).findOneBy({ id: request.user.id })
        if (!user) {
            return reply.status(404).send({ status: 'error', message: 'User not found' })
        }

        const post = posts().create({ title, content, user })
        const saved = await posts().save(post)
        return reply.status(201).send({
            status: 'success',
            message: 'Post created successfully',
            data: { post: saved },
        })
    })

    app.get('/:id', async (request, reply) => {
        const { id } = request.params as { id: string }
        const post = await posts().findOne({
            where: { id },
            relations: ['user', 'comments', 'comments.user'],
        })
        if (!post) {
            return reply.status(404).send({ status: 'error', message: 'Post not found' })
        }
        return reply.send({ status: 'success', data: { post } })
    })

    app.patch('/:id', async (request, reply) => {
        const { id } = request.params as { id: string }
        const post = await posts().findOne({ where: { id }, relations: ['user'] })
        if (!post) {
            return reply.status(404).send({ status: 'error', message: 'Post not found' })
        }
        const { title, content, imageUrl } = (request.body ?? {}) as Partial<Post>
        if (title !== undefined) post.title = title
        if (content !== undefined) post.content = content
        if (imageUrl !== undefined) post.imageUrl = imageUrl
        await posts().save(post)
        return reply.send({ status: 'success', message: 'Post updated', data: { post } })
    })

    app.delete('/:id', async (request, reply) => {
        const { id } = request.params as { id: string }
        const post = await posts().findOneBy({ id })
        if (!post) {
            return reply.status(404).send({ status: 'error', message: 'Post not found' })
        }
        await posts().remove(post)
        return reply.send({ status: 'success', message: 'Post deleted successfully' })
    })

    app.get('/:id/user', async (request, reply) => {
        const { id } = request.params as { id: string }
        const post = await posts().findOne({ where: { id }, relations: ['user'] })
        if (!post) {
            return reply.status(404).send({ status: 'error', message: 'Post not found' })
        }
        return reply.send({ status: 'success', message: 'User found', data: { user: post.user } })
    })

    app.get('/:postId/comments', async (request, reply) => {
        const { postId } = request.params as { postId: string }
        const list = await comments().find({
            where: { post: { id: postId } },
            relations: ['user'],
            order: { createdAt: 'ASC' },
        })
        return reply.send({ status: 'success', data: { comments: list } })
    })

    app.post('/:postId/comments', async (request, reply) => {
        const { postId } = request.params as { postId: string }
        const { content } = (request.body ?? {}) as { content?: string }
        if (!content) {
            return reply.status(400).send({ status: 'error', message: 'Content is required' })
        }
        const post = await posts().findOneBy({ id: postId })
        if (!post) {
            return reply.status(404).send({ status: 'error', message: 'Post not found' })
        }
        const user = await db.getRepository(User).findOneBy({ id: request.user.id })
        if (!user) {
            return reply.status(404).send({ status: 'error', message: 'User not found' })
        }

        const comment = comments().create({ content, post, user })
        const saved = await comments().save(comment)
        return reply.status(201).send({
            status: 'success',
            message: 'Comment created successfully',
            data: { comment: saved },
        })
    })

    app.patch('/:postId/comments/:id', async (request, reply) => {
        const { id } = request.params as { id: string }
        const comment = await comments().findOne({ where: { id }, relations: ['user'] })
        if (!comment) {
            return reply.status(404).send({ status: 'error', message: 'Comment not found' })
        }
        const { content } = (request.body ?? {}) as { content?: string }
        if (content !== undefined) comment.content = content
        await comments().save(comment)
        return reply.send({ status: 'success', message: 'Comment updated', data: { comment } })
    })

    app.delete('/:postId/comments/:id', async (request, reply) => {
        const { id } = request.params as { id: string }
        const comment = await comments().findOneBy({ id })
        if (!comment) {
            return reply.status(404).send({ status: 'error', message: 'Comment not found' })
        }
        await comments().remove(comment)
        return reply.send({ status: 'success', message: 'Comment deleted successfully' })
    })
}