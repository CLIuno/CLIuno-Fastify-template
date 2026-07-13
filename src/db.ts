import 'reflect-metadata'
import { DataSource } from 'typeorm'

import { BlacklistedToken, Comment, Follow, Post, Role, Todo, User } from './entities'

export const db = new DataSource({
    type: 'better-sqlite3',
    database: process.env.DB_FILE || 'db.sqlite',
    synchronize: true,
    entities: [User, Role, Todo, Post, Comment, Follow, BlacklistedToken],
})

// Default role is created on first use so a fresh install works out of the box
export async function defaultRole(name = 'user'): Promise<Role> {
    const repo = db.getRepository(Role)
    let role = await repo.findOneBy({ name })
    role ??= await repo.save(repo.create({ name }))
    return role
}

// Public view of a user — never leak password or secret columns
export function safeUser(user: User) {
    const view: Record<string, unknown> = { ...user }
    for (const secret of [
        'password',
        'otp_base32',
        'otp_auth_url',
        'refresh_token',
        'reset_token',
        'verify_token',
    ]) {
        delete view[secret]
    }
    return view
}