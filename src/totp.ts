import crypto from 'node:crypto'
import { encode } from 'hi-base32'
import * as OTPAuth from 'otpauth'

export const generateBase32Secret = (): string =>
    encode(crypto.randomBytes(15)).replaceAll('=', '').substring(0, 24)

export const buildTotp = (label: string, secret: string) =>
    new OTPAuth.TOTP({
        issuer: process.env.FRONTEND_URL || 'CLIuno',
        label,
        algorithm: 'SHA1',
        digits: 6,
        secret,
    })

export const verifyTotp = (label: string, secret: string, code: string | undefined): boolean =>
    buildTotp(label, secret).validate({ token: String(code ?? ''), window: 1 }) !== null