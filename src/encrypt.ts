import crypto from 'crypto'

export const ENCRYPTION_KEY_LENGTH = 32

export function encrypt(text: string, key: Buffer): string {
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv('aes256', key, iv)
  const ct = cipher.update(text, 'utf8', 'hex') + cipher.final('hex')
  return JSON.stringify({ iv, ct })
}

export function decrypt(encoded: string, key: Buffer) {
  const { iv, ct } = JSON.parse(encoded)
  const ivb = Buffer.from(iv, 'hex')
  const decipher = crypto.createDecipheriv('aes256', key, ivb)
  return decipher.update(ct, 'hex', 'utf8') + decipher.final('utf8')
}
