/**
 * Utility functions for base64url encoding/decoding
 */

export const base64url = {
  encode(data: string | Uint8Array): string {
    let base64: string
    
    if (typeof data === 'string') {
      base64 = btoa(data)
    } else {
      // Convert Uint8Array to string
      const binaryString = Array.from(data, byte => String.fromCharCode(byte)).join('')
      base64 = btoa(binaryString)
    }
    
    // Convert base64 to base64url
    return base64
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '')
  },

  decode(data: string): Uint8Array {
    // Convert base64url to base64
    let base64 = data
      .replace(/-/g, '+')
      .replace(/_/g, '/')
    
    // Add padding if needed
    while (base64.length % 4) {
      base64 += '='
    }
    
    // Decode base64 to binary string
    const binaryString = atob(base64)
    
    // Convert to Uint8Array
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }
    
    return bytes
  }
}
