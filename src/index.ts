import { Hono } from 'hono'
import type { Env, AppendPayload, AppendResponse, ProjectConfig } from './types'
import { appendToSheet } from './sheets'

const app = new Hono<Env>()

// CORS middleware
app.use('*', async (c, next) => {
  const allowedOrigins = c.env.ALLOWED_ORIGINS || '*'
  c.header('Access-Control-Allow-Origin', allowedOrigins)
  c.header('Access-Control-Allow-Headers', 'content-type')
  c.header('Access-Control-Allow-Methods', 'POST, OPTIONS')
  
  if (c.req.method === 'OPTIONS') {
    return c.body(null, 204)
  }
  
  await next()
})

// Health check endpoint
app.get('/', (c) => {
  return c.json({
    service: 'sheets-api',
    version: '2.0.0',
    status: 'healthy',
    endpoints: [
      'GET  /',
      'POST /:projectId/:listName'
    ]
  })
})

// Helper function to get project configuration
function getProjectConfig(projectId: string, env: Env['Bindings']): ProjectConfig {
  try {
    const projectsConfig = JSON.parse(env.PROJECTS_CONFIG || '{}')
    const project = projectsConfig[projectId]
    if (!project) {
      throw new Error(`Project "${projectId}" not found`)
    }
    return project
  } catch (error) {
    if (error instanceof Error) {
      throw error
    }
    throw new Error('Invalid PROJECTS_CONFIG format')
  }
}

// Helper function to resolve sheet configuration
function resolveSheetConfig(
  projectId: string,
  listName: string,
  env: Env['Bindings']
) {
  const projectConfig = getProjectConfig(projectId, env)
  
  const range = projectConfig.ranges[listName]
  if (!range) {
    throw new Error(`List "${listName}" not found in project "${projectId}"`)
  }

  const sheetId = projectConfig.sheetId
  const saEmail = env.SA_EMAIL
  const saPrivateKey = env.SA_PRIVATE_KEY

  return { sheetId, range, saEmail, saPrivateKey }
}

// Main endpoint - project and list are required
app.post('/:projectId/:listName', async (c) => {
  const startTime = Date.now()
  const projectId = c.req.param('projectId')
  const listName = c.req.param('listName')
  
  try {
    const body = await c.req.json<AppendPayload>().catch(() => null)
    
    if (!body || !body.data) {
      return c.json<AppendResponse>({ 
        ok: false, 
        error: 'invalid_payload' 
      }, 400)
    }

    const config = resolveSheetConfig(projectId, listName, c.env)

    // Normalize data to array of objects
    const items = Array.isArray(body.data) ? body.data : [body.data]

    // Append to sheet using google-spreadsheet library
    const result = await appendToSheet(
      config.sheetId,
      config.range,
      items,
      config.saEmail,
      config.saPrivateKey
    )

    const duration = Date.now() - startTime
    
    console.log(`[${new Date().toISOString()}] SUCCESS - project: ${projectId}, list: ${listName}, written: ${result.written}, duration: ${duration}ms`)

    return c.json<AppendResponse>({ 
      ok: true, 
      written: result.written
    })

  } catch (error) {
    const duration = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    console.log(`[${new Date().toISOString()}] ERROR - project: ${projectId}, list: ${listName}, error: ${errorMessage}, duration: ${duration}ms`)
    
    return c.json<AppendResponse>({ 
      ok: false, 
      error: 'append_failed',
      detail: errorMessage
    }, 502)
  }
})



export default app
