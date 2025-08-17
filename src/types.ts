export type Env = {
  Bindings: {
    SA_EMAIL: string
    SA_PRIVATE_KEY: string
    ALLOWED_ORIGINS?: string
    
    // Projects configuration in JSON format
    // Example: {"project1": {"sheetId": "...", "ranges": {"leads": "Leads!A:Z"}}}
    PROJECTS_CONFIG: string
  }
}

export type ProjectConfig = {
  sheetId: string
  ranges: Record<string, string> // listName -> range
}

export type AppendPayload = {
  data: Record<string, unknown> | Record<string, unknown>[]
}

export type AppendResponse = {
  ok: boolean
  written?: number
  error?: string
  detail?: string
}
