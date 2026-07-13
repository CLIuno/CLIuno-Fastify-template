import crypto from 'node:crypto'
import type { FastifyReply, FastifyRequest } from 'fastify'
import jwt from 'jsonwebtoken'

import { db, safeUser } from './db'
import { BlacklistedToken, User } from './entities'

const JWT_SECRET = process.env.JWT_SECRET_KEY || 'dev-jwt-secret-change-me'
const REFRESH_SECRET = process.env.REFRESH_JWT_SECRET_KEY || 'dev-refresh-secret-change-me'

export type TokenPayload = { id: string; username: string; email: string }

export const signToken = (u: TokenPayload) =>
    jwt.sign({ id: u.id, username: u.username, email: u.email }, JWT_SECRET, { expiresIn: '1h' })

export const signRefreshToken = (u: TokenPayload) =>
    jwt.sign({ id: u.id, username: u.username, email: u.email }, REFRESH_SECRET, {
        expiresIn: '7d',
    })

export const verifyRefreshToken = (token: string): TokenPayload | null => {
    try {
        return jwt.verify(token, REFRESH_SECRET) as TokenPayload
    } catch {
        return null
    }
}

export const randomToken = () => crypto.randomBytes(20).toString('hex')

export const bearerOf = (request: FastifyRequest) =>
    request.headers.authorization?.split(' ')[1] ?? null

// preHandler: require a valid, non-blacklisted Bearer token → request.user
export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
    const token = bearerOf(request)
    if (!token) {
        return reply.status(401).send({ status: 'error', message: 'No token provided' })
    }

    const blacklisted = await db.getRepository(BlacklistedToken).findOneBy({ token })
    if (blacklisted) {
        return reply
            .status(401)
            .send({ status: 'error', message: 'Token has already been invalidated' })
    }

    try {
        request.user = jwt.verify(token, JWT_SECRET) as TokenPayload
    } catch {
        return reply.status(401).send({ status: 'error', message: 'Invalid token' })
    }
}

// preHandler (after authenticate): require the `admin` role
export async function adminOnly(request: FastifyRequest, reply: FastifyReply) {
    const user = await db.getRepository(User).findOne({
        where: { id: request.user.id },
        relations: ['role'],
    })
    if (user?.role?.name !== 'admin') {
        return reply.status(403).send({ status: 'error', message: 'Forbidden: Permission denied' })
    }
}

export async function currentUser(request: FastifyRequest): Promise<User | null> {
    return db.getRepository(User).findOne({ where: { id: request.user.id }, relations: ['role'] })
}

export { safeUser }

declare module 'fastify' {
    interface FastifyRequest {
        user: TokenPayload
    }
}