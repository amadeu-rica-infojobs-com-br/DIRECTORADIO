import { createHash, randomBytes } from 'node:crypto'

/** Token de verificación de un solo uso. En la base de datos solo se guarda su SHA-256. */
export function newToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString('base64url')
  return { token, hash: hashToken(token) }
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}
