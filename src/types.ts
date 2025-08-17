import { z } from 'zod'

export type Env = {
  Bindings: {
    SA_EMAIL: string
    SA_PRIVATE_KEY: string
    ALLOWED_ORIGINS?: string
    
    // Projects configuration in JSON format (optional for direct usage)
    // Example: {"myproject": {"sheetId": "...", "ranges": {"contacts": "Contacts!A:Z"}}}
    PROJECTS_CONFIG: string
  }
}

export type ProjectConfig = {
  sheetId: string
  ranges: Record<string, string> // listName -> range
}

// Zod schemas for validation
export const AppendPayloadSchema = z.object({
  data: z.union([
    z.record(z.string(), z.unknown()),
    z.array(z.record(z.string(), z.unknown()))
  ])
})

export const AppendResponseSchema = z.object({
  ok: z.boolean(),
  written: z.number().optional(),
  error: z.string().optional(),
  detail: z.string().optional()
})

export const AppendSuccessResponseSchema = z.object({
  ok: z.literal(true),
  written: z.number()
})

export const AppendErrorResponseSchema = z.object({
  ok: z.literal(false),
  error: z.string(),
  detail: z.string().optional()
})

export const HealthResponseSchema = z.object({
  service: z.string(),
  version: z.string(),
  status: z.string(),
  endpoints: z.array(z.string())
})

export const ParamsSchema = z.object({
  projectId: z.string(),
  listName: z.string()
})

export const DirectParamsSchema = z.object({
  sheetId: z.string(),
  range: z.string()
})

export type AppendPayload = z.infer<typeof AppendPayloadSchema>
export type AppendResponse = z.infer<typeof AppendResponseSchema>
export type DirectParams = z.infer<typeof DirectParamsSchema>
