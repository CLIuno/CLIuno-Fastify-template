import type { FastifyInstance } from 'fastify'
import bcrypt from 'bcrypt'

import {
    authenticate,
    bearerOf,
    currentUser,
    randomToken,
    safeUser,
    signRefreshToken,
    signToken,
    verifyRefreshToken,
} from '../auth'
import { db, defaultRole } from '../db'
import { BlacklistedToken, User } from '../entities'
import { buildTotp, generateBase32Secret, verifyTotp } from '../totp'

const SALT_ROUNDS = 10

type RegisterBody = {
    username?: string
    first_name?: string
    last_name?: string
    email?: string
    phone?: string
    password?: string
    password_confirmation?: string
}

export default async function authRoutes(app: FastifyInstance) {
    const users = () => db.getRepository(User)

    app.post('/register', async (request, reply) => {
        const body = (request.body ?? {}) as RegisterBody
        const { username, first_name, last_name, email, phone, password } = body

        if (!username || !first_name || !last_name || !email || !password) {
            return reply.status(400).send({ status: 'warning', message: 'Missing required fields' })
        }
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
            return reply.status(400).send({ status: 'warning', message: 'Invalid email address' })
        }
        if (password.length < 8) {
            return reply
                .status(400)
                .send({ status: 'warning', message: 'Password must be at least 8 characters' })
        }

        const exists = await users().findOne({ where: [{ username }, { email }] })
        if (exists) {
            return reply.status(400).send({ status: 'warning', message: 'User already exists' })
        }

        const role = await defaultRole()
        // The verify token is stored so verify-email can look the user up by token later.
        const verifyToken = randomToken()
        const user = users().create({
            username,
            first_name,
            last_name,
            email,
            phone: phone || null,
            password: await bcrypt.hash(password, SALT_ROUNDS),
            role,
            verify_token: verifyToken,
        })
        await users().save(user)
        // In production, email the token; templates keep it local to the database.

        return reply.status(201).send({
            status: 'success',
            message: 'User created successfully and an email has been sent to you for verification',
            data: { user: safeUser(user) },
        })
    })

    app.post('/login', async (request, reply) => {
        const { usernameOrEmail, password } = (request.body ?? {}) as {
            usernameOrEmail?: string
            password?: string
        }
        if (!usernameOrEmail || !password) {
            return reply
                .status(400)
                .send({ status: 'warning', message: 'usernameOrEmail and password are required' })
        }

        const isEmail = usernameOrEmail.includes('@')
        const user = await users().findOneBy(
            isEmail ? { email: usernameOrEmail } : { username: usernameOrEmail },
        )
        if (!user || user.is_deleted || !(await bcrypt.compare(password, user.password))) {
            return reply
                .status(401)
                .send({ status: 'error', message: 'Invalid username/email or password' })
        }

        const token = signToken(user)
        const refreshToken = signRefreshToken(user)
        user.refresh_token = refreshToken
        user.is_online = true
        await users().save(user)

        return reply.send({
            status: 'success',
            message: 'Login successful',
            data: {
                user: safeUser(user),
                first_name: user.first_name,
                last_name: user.last_name,
                is_otp_enabled: user.is_otp_enabled,
                token,
                refreshToken,
            },
        })
    })

    app.post('/logout', { preHandler: authenticate }, async (request, reply) => {
        const token = bearerOf(request)
        if (token) {
            await db
                .getRepository(BlacklistedToken)
                .save({ token, invalidatedAt: new Date().toISOString() as unknown as Date })
        }
        await users().update({ id: request.user.id }, { is_online: false, refresh_token: null })
        return reply.send({ status: 'success', message: 'Logout successful' })
    })

    app.post('/check-token', { preHandler: authenticate }, async (request, reply) => {
        const user = await currentUser(request)
        return reply.send({
            status: 'success',
            message: 'Token is valid',
            data: { user: user ? safeUser(user) : null },
        })
    })

    app.post('/refresh-token', async (request, reply) => {
        // Frontends send the refresh token in the body; the header is a fallback
        const body = (request.body ?? {}) as { refreshToken?: string }
        const token = body.refreshToken ?? bearerOf(request)
        const decoded = token ? verifyRefreshToken(token) : null
        if (!decoded) {
            return reply
                .status(401)
                .send({ status: 'error', message: 'Invalid or expired refresh token' })
        }

        const user = await users().findOneBy({ id: decoded.id })
        if (!user || user.refresh_token !== token) {
            return reply.status(401).send({ status: 'error', message: 'Invalid refresh token' })
        }

        const newToken = signToken(user)
        const newRefreshToken = signRefreshToken(user)
        user.refresh_token = newRefreshToken
        await users().save(user)

        return reply.send({
            status: 'success',
            message: 'Token refreshed successfully',
            data: { token: newToken, refreshToken: newRefreshToken },
        })
    })

    app.post('/change-password', { preHandler: authenticate }, async (request, reply) => {
        const { oldPassword, newPassword } = (request.body ?? {}) as {
            oldPassword?: string
            newPassword?: string
        }
        if (!oldPassword || !newPassword || newPassword.length < 8) {
            return reply
                .status(400)
                .send({ status: 'warning', message: 'oldPassword and newPassword are required' })
        }

        const user = await users().findOneBy({ id: request.user.id })
        if (!user || !(await bcrypt.compare(oldPassword, user.password))) {
            return reply
                .status(400)
                .send({ status: 'error', message: 'Current password is incorrect' })
        }

        user.password = await bcrypt.hash(newPassword, SALT_ROUNDS)
        await users().save(user)
        return reply.send({ status: 'success', message: 'Password changed successfully' })
    })

    app.post('/forgot-password', async (request, reply) => {
        // Frontends send `email`; `usernameOrEmail` is kept for compatibility
        const body = (request.body ?? {}) as { email?: string; usernameOrEmail?: string }
        const login = body.email || body.usernameOrEmail
        if (!login) {
            return reply.status(400).send({ status: 'warning', message: 'Email is required' })
        }

        const isEmail = login.includes('@')
        const user = await users().findOneBy(isEmail ? { email: login } : { username: login })
        if (user) {
            user.reset_token = randomToken()
            await users().save(user)
            // In production, email the token; templates keep it local to the database.
        }
        return reply.send({
            status: 'success',
            message: 'If the email exists, a reset link has been sent',
        })
    })

    app.post('/reset-password', async (request, reply) => {
        const { password, token } = (request.body ?? {}) as { password?: string; token?: string }
        const user = token ? await users().findOneBy({ reset_token: token }) : null
        if (!user) {
            return reply
                .status(400)
                .send({ status: 'error', message: 'Invalid or expired reset token' })
        }
        if (!password || password.length < 8) {
            return reply
                .status(400)
                .send({ status: 'warning', message: 'Password must be at least 8 characters' })
        }

        user.password = await bcrypt.hash(password, SALT_ROUNDS)
        user.reset_token = null
        await users().save(user)
        return reply.send({ status: 'success', message: 'Password reset successful' })
    })

    app.post('/send-verify-email', { preHandler: authenticate }, async (request, reply) => {
        const user = await users().findOneBy({ id: request.user.id })
        if (!user) {
            return reply.status(404).send({ status: 'error', message: 'User not found' })
        }
        user.verify_token = randomToken()
        await users().save(user)
        // In production, email the token; templates keep it local to the database.
        return reply.send({ status: 'success', message: 'Email sent successfully' })
    })

    app.post('/verify-email', async (request, reply) => {
        const { token } = (request.body ?? {}) as { token?: string }
        const user = token ? await users().findOneBy({ verify_token: token }) : null
        if (!user) {
            return reply
                .status(400)
                .send({ status: 'error', message: 'Invalid or expired verification token' })
        }

        user.is_verified = true
        user.verify_token = null
        await users().save(user)
        return reply.send({ status: 'success', message: 'Email verified successfully' })
    })

    // OTP endpoints act on the authenticated user (RFC 6238 TOTP)
    app.post('/otp/generate', { preHandler: authenticate }, async (request, reply) => {
        const user = await users().findOneBy({ id: request.user.id })
        if (!user) {
            return reply.status(404).send({ status: 'error', message: 'User not found' })
        }

        const secret = generateBase32Secret()
        user.otp_base32 = secret
        user.otp_auth_url = buildTotp(user.username, secret).toString()
        user.is_otp_enabled = false
        await users().save(user)

        return reply.send({
            status: 'success',
            message: 'OTP secret generated',
            data: { secret, base32: secret, otpauth_url: user.otp_auth_url },
        })
    })

    app.post('/otp/verify', { preHandler: authenticate }, async (request, reply) => {
        const { otp, token } = (request.body ?? {}) as { otp?: string; token?: string }
        const user = await users().findOneBy({ id: request.user.id })
        if (!user?.otp_base32) {
            return reply.status(400).send({ status: 'error', message: 'OTP is not set up' })
        }
        if (!verifyTotp(user.username, user.otp_base32, otp ?? token)) {
            return reply.status(401).send({ status: 'error', message: 'Invalid OTP code' })
        }

        user.is_otp_enabled = true
        await users().save(user)
        return reply.send({ status: 'success', message: 'OTP verified successfully' })
    })

    app.post('/otp/validate', { preHandler: authenticate }, async (request, reply) => {
        const { otp, token } = (request.body ?? {}) as { otp?: string; token?: string }
        const user = await users().findOneBy({ id: request.user.id })
        if (!user?.otp_base32 || !user.is_otp_enabled) {
            return reply
                .status(400)
                .send({ status: 'error', message: 'OTP is not enabled for this user' })
        }
        if (!verifyTotp(user.username, user.otp_base32, otp ?? token)) {
            return reply.status(401).send({ status: 'error', message: 'Invalid OTP code' })
        }
        return reply.send({ status: 'success', message: 'Token is valid' })
    })

    app.post('/otp/disable', { preHandler: authenticate }, async (request, reply) => {
        await users().update(
            { id: request.user.id },
            { is_otp_enabled: false, otp_base32: null, otp_auth_url: null },
        )
        return reply.send({ status: 'success', message: 'OTP disabled successfully' })
    })
}