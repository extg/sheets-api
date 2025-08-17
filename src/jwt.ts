/**
 * JWT implementation using Web Crypto API for Cloudflare Workers
 * This replaces the google-auth-library which uses Node.js crypto.createSign
 */

import { base64url } from './utils'

interface JWTHeader {
  alg: string
  typ: string
}

interface JWTPayload {
  iss: string
  scope: string
  aud: string
  exp: number
  iat: number
}

export class WebCryptoJWT {
  private email: string
  private privateKey: string
  private scopes: string[]

  constructor(email: string, privateKey: string, scopes: string[]) {
    this.email = email
    this.privateKey = privateKey
    this.scopes = scopes
  }

  async getAccessToken(): Promise<string> {
    const jwt = await this.createJWT()
    const response = await this.exchangeJWTForToken(jwt)
    return response.access_token
  }

  private async createJWT(): Promise<string> {
    const header: JWTHeader = {
      alg: 'RS256',
      typ: 'JWT'
    }

    const now = Math.floor(Date.now() / 1000)
    const payload: JWTPayload = {
      iss: this.email,
      scope: this.scopes.join(' '),
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600, // 1 hour
      iat: now
    }

    const headerB64 = base64url.encode(JSON.stringify(header))
    const payloadB64 = base64url.encode(JSON.stringify(payload))
    const data = `${headerB64}.${payloadB64}`

    // Import the private key
    const keyData = this.pemToArrayBuffer(this.privateKey)
    const key = await crypto.subtle.importKey(
      'pkcs8',
      keyData,
      {
        name: 'RSASSA-PKCS1-v1_5',
        hash: 'SHA-256'
      },
      false,
      ['sign']
    )

    // Sign the data
    const signature = await crypto.subtle.sign(
      'RSASSA-PKCS1-v1_5',
      key,
      new TextEncoder().encode(data)
    )

    const signatureB64 = base64url.encode(new Uint8Array(signature))
    return `${data}.${signatureB64}`
  }

  private async exchangeJWTForToken(jwt: string): Promise<{ access_token: string }> {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt
      })
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Token exchange failed: ${error}`)
    }

    return response.json()
  }

  private pemToArrayBuffer(pem: string): ArrayBuffer {
    // Remove PEM header/footer and whitespace
    const pemContents = pem
      .replace(/-----BEGIN PRIVATE KEY-----/, '')
      .replace(/-----END PRIVATE KEY-----/, '')
      .replace(/\s/g, '')

    // Convert base64 to ArrayBuffer
    const binaryString = atob(pemContents)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }
    return bytes.buffer
  }
}
