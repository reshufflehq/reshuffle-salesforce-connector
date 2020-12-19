import open from 'open'
import jsforce from 'jsforce'
import { ENCRYPTION_KEY_LENGTH } from './encrypt'

export const AUTHPATH = '/reshuffle-salesforce-connector/oauth'

export function openAuthenticationWindow(
  clientId?: string,
  clientSecret?: string,
  baseURL?: string,
): string {
  const oauth2 = new jsforce.OAuth2({
    clientId: validateClientId(clientId),
    clientSecret: validateClientSecret(clientSecret),
    redirectUri: validateBaseURL(baseURL) + AUTHPATH,
  })

  const url = oauth2.getAuthorizationUrl({ scope: 'full refresh_token' })
  open(url).catch(console.error)
  return url
}

export function validateBaseURL(url?: string): string {
  if (typeof url !== 'string') {
    throw new Error(`Invalid url: ${url}`)
  }
  const match = url.match(/^(https:\/\/[\w-]+(\.[\w-]+)*(:\d{1,5})?)\/?$/)
  if (!match) {
    throw new Error(`Invalid url: ${url}`)
  }
  return match[1]
}

export function validateClientId(clientId?: string): string {
  if (!/^[A-Za-z0-9\._]{85}$/.test(clientId || '')) {
    throw new Error(`Invalid clientId: ${clientId}`)
  }
  return clientId!
}

export function validateClientSecret(clientSecret?: string): string {
  if (!/^[A-Z0-9]{64}$/.test(clientSecret || '')) {
    throw new Error(`Invalid clientSecret: ${clientSecret}`)
  }
  return clientSecret!
}

const encryptionKeyRegex = new RegExp(
  `^[0-9a-fA-F]{${ENCRYPTION_KEY_LENGTH * 2}}$`
)

export function validateEncryptionKey(key: string | Buffer): Buffer {
  if (typeof key === 'string') {
    if (!encryptionKeyRegex.test(key)) {
      throw new Error(`Invalid encryption key: ${key}`)
    }
    return Buffer.from(key, 'hex')
  }
  if (typeof key === 'object' && key instanceof Buffer) {
    if (key.length !== ENCRYPTION_KEY_LENGTH) {
      throw new Error(`Invalid encryption key: ${key}`)
    }
    return key
  }
  throw new Error(`Invalid encryption key: ${key}`)
}

const queryRegex = new RegExp(
  '^\\s*(SELECT|select)\\s+([A-Z]\\w+)(\\s*,\\s*[A-Z]\\w+)*\\s+' +
  '(FROM|from)\\s+[A-Z]\\w+\\s*$'
)

export function validateQuery(query?: string): string {
  if (!queryRegex.test(query || '')) {
    throw new Error(`Invalid query: ${query}`)
  }
  return query!.trim().replace(/\s\s+/g, ' ').replace(/\s?,\s?/g, ',')
}

export function validateToken(token?: string): string {
  if (typeof token !== 'string' || !/^[0-9a-zA-Z\._!]+$/.test(token)) {
    throw new Error(`Invalid token: ${token}`)
  }
  return token
}
