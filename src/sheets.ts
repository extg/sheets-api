/**
 * Google Sheets client implementation using Web Crypto API and direct HTTP requests
 * This replaces the google-spreadsheet library which depends on Node.js crypto
 */

import { WebCryptoJWT } from './jwt'

interface SheetInfo {
  spreadsheetId: string
  properties: {
    title: string
  }
  sheets: Array<{
    properties: {
      sheetId: number
      title: string
      gridProperties: {
        rowCount: number
        columnCount: number
      }
    }
  }>
}

interface ValueRange {
  range: string
  majorDimension: string
  values: unknown[][]
}

interface AppendResponse {
  spreadsheetId: string
  tableRange: string
  updates: {
    spreadsheetId: string
    updatedRows: number
    updatedColumns: number
    updatedCells: number
  }
}

export class WebCryptoSheetsClient {
  private serviceAccountEmail: string
  private privateKey: string
  private accessToken: string | null = null
  private tokenExpiry: number = 0

  constructor(serviceAccountEmail: string, privateKey: string) {
    this.serviceAccountEmail = serviceAccountEmail
    this.privateKey = privateKey
  }

  private async getAccessToken(): Promise<string> {
    const now = Date.now()
    
    // Check if we have a valid token
    if (this.accessToken && now < this.tokenExpiry) {
      return this.accessToken
    }

    // Create new JWT client and get access token
    const jwt = new WebCryptoJWT(
      this.serviceAccountEmail,
      this.privateKey,
      ['https://www.googleapis.com/auth/spreadsheets']
    )
    
    this.accessToken = await jwt.getAccessToken()
    this.tokenExpiry = now + (55 * 60 * 1000) // 55 minutes (tokens are valid for 1 hour)
    
    return this.accessToken
  }

  async getSpreadsheetInfo(spreadsheetId: string): Promise<SheetInfo> {
    const token = await this.getAccessToken()
    
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    )

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Failed to get spreadsheet info: ${error}`)
    }

    return response.json()
  }

  async appendValues(
    spreadsheetId: string,
    range: string,
    values: unknown[][]
  ): Promise<{ updatedRows: number }> {
    const token = await this.getAccessToken()
    
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          values
        })
      }
    )

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Failed to append values: ${error}`)
    }

    const result = await response.json() as AppendResponse
    return {
      updatedRows: result.updates?.updatedRows || 0
    }
  }
}

export async function appendToSheet(
  sheetId: string,
  range: string,
  data: Record<string, unknown>[],
  serviceAccountEmail: string,
  privateKey: string
): Promise<{ written: number }> {
  // Replace escaped newlines from env vars
  const client = new WebCryptoSheetsClient(serviceAccountEmail, privateKey.replace(/\\n/g, '\n'))
  
  // Get spreadsheet info to validate sheet exists
  const sheetInfo = await client.getSpreadsheetInfo(sheetId)
  
  // Parse range to get sheet name
  const sheetName = range.includes('!') ? range.split('!')[0] : undefined
  
  // Find the target sheet
  let targetSheet
  if (sheetName) {
    targetSheet = sheetInfo.sheets.find(sheet => sheet.properties.title === sheetName)
    if (!targetSheet) {
      throw new Error(`Sheet "${sheetName}" not found`)
    }
  } else {
    targetSheet = sheetInfo.sheets[0]
    if (!targetSheet) {
      throw new Error('No sheets found in spreadsheet')
    }
  }

  // Convert data objects to 2D array
  if (data.length === 0) {
    return { written: 0 }
  }

  // Get all unique keys from all objects to determine columns
  const allKeys = new Set<string>()
  data.forEach(item => {
    Object.keys(item).forEach(key => allKeys.add(key))
  })
  const columns = Array.from(allKeys)

  // Convert objects to rows
  const values = data.map(item => 
    columns.map(key => item[key] ?? '')
  )

  // Use the full range or construct one for the target sheet
  const targetRange = sheetName ? range : `${targetSheet.properties.title}!A:Z`
  
  const result = await client.appendValues(sheetId, targetRange, values)
  
  return { written: result.updatedRows }
}
