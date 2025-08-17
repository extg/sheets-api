import { GoogleSpreadsheet } from 'google-spreadsheet'
import { JWT } from 'google-auth-library'

export async function appendToSheet(
  sheetId: string,
  range: string,
  data: Record<string, unknown>[],
  serviceAccountEmail: string,
  privateKey: string
): Promise<{ written: number }> {
  // Initialize JWT auth
  const serviceAccountAuth = new JWT({
    email: serviceAccountEmail,
    key: privateKey.replace(/\\n/g, '\n'), // Handle escaped newlines from env vars
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  })

  // Initialize the spreadsheet
  const doc = new GoogleSpreadsheet(sheetId, serviceAccountAuth)
  await doc.loadInfo()

  // Parse range to get sheet name (e.g., "Leads!A:Z" -> "Leads")
  const sheetName = range.includes('!') ? range.split('!')[0] : undefined
  
  // Get the sheet by name or use the first sheet
  const sheet = sheetName 
    ? doc.sheetsByTitle[sheetName] || doc.sheetsByIndex[0]
    : doc.sheetsByIndex[0]

  if (!sheet) {
    throw new Error(`Sheet not found: ${sheetName || 'first sheet'}`)
  }

  // Add rows to the sheet (google-spreadsheet expects an array of objects)
  const addedRows = await sheet.addRows(data as any)
  
  return { written: addedRows.length }
}
