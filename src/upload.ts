import fs from 'fs'
import path from 'path'

import type { FastifyRequest } from 'fastify'

// Uploaded files live at the repo root and are served statically from /uploads.
export const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads')

// 5 MB — matches every other CLIuno backend template.
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024

// The extension comes from the detected mime, never from the client's filename.
export const ALLOWED_IMAGE_TYPES: Record<string, string> = {
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'image/webp': '.webp',
    'image/gif': '.gif',
}

export function ensureUploadDir(): string {
    if (!fs.existsSync(UPLOAD_DIR)) {
        fs.mkdirSync(UPLOAD_DIR, { recursive: true })
    }
    return UPLOAD_DIR
}

// Absolute so a frontend on another origin can use it straight as an image source.
export function publicUploadUrl(request: FastifyRequest, filename: string): string {
    const base = process.env.PUBLIC_BASE_URL || `${request.protocol}://${request.host}`
    return `${base.replace(/\/+$/, '')}/uploads/${filename}`
}