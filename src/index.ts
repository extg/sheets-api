import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { Scalar } from '@scalar/hono-api-reference'

import type { 
  Env, 
  AppendPayload, 
  AppendResponse, 
  ProjectConfig 
} from './types'
import { 
  AppendPayloadSchema
} from './types'
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

// Swagger UI as default page
app.get('/', 
  Scalar({
    theme: 'kepler',
    spec: { url: '/openapi' }
  } as any)
)

// Health check endpoint
app.get('/health', (c) => {
  const currentUrl = new URL(c.req.url)
  
  return c.json({
    service: 'sheets-api',
    version: '2.0.0',
    status: 'healthy',
    server: {
      url: currentUrl.origin,
      host: currentUrl.hostname,
      protocol: currentUrl.protocol,
      port: currentUrl.port || (currentUrl.protocol === 'https:' ? '443' : '80')
    },
    endpoints: [
      'GET  / (docs)',
      'GET  /health',
      'POST /:projectId/:listName',
      'GET  /openapi'
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

  console.log('range', range)
  console.log('sheetId', sheetId)
  console.log('saEmail', saEmail)
  console.log('saPrivateKey', saPrivateKey)

  return { sheetId, range, saEmail, saPrivateKey }
}

// Main endpoint - project and list are required
app.post(
  '/:projectId/:listName',
  zValidator('json', AppendPayloadSchema),
  async (c) => {
    const startTime = Date.now()
    const projectId = c.req.param('projectId')
    const listName = c.req.param('listName')
    
    try {
      const body = c.req.valid('json')

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
  }
)

// OpenAPI specification endpoint
app.get('/openapi', (c) => {
  // Get current URL dynamically
  const currentUrl = new URL(c.req.url)
  const baseUrl = currentUrl.origin
  
  const openApiSpec = {
    openapi: '3.0.0',
    info: {
      title: 'Sheets API',
      version: '2.0.0',
      description: 'Universal Google Sheets API service with auto-mapping support. This API allows you to append data to Google Sheets through pre-configured projects and ranges.'
    },
    servers: [
      {
        url: baseUrl,
        description: baseUrl.includes('localhost') ? 'Development server' : 'Production server'
      }
    ],
    paths: {
      '/health': {
        get: {
          summary: 'Health Check',
          description: 'Check API health and get service information',
          tags: ['Health'],
          responses: {
            '200': {
              description: 'Service is healthy',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      service: { type: 'string', example: 'sheets-api' },
                      version: { type: 'string', example: '2.0.0' },
                      status: { type: 'string', example: 'healthy' },
                      server: {
                        type: 'object',
                        properties: {
                          url: { type: 'string', example: 'https://your-worker.your-subdomain.workers.dev' },
                          host: { type: 'string', example: 'your-worker.your-subdomain.workers.dev' },
                          protocol: { type: 'string', example: 'https:' },
                          port: { type: 'string', example: '443' }
                        }
                      },
                      endpoints: { 
                        type: 'array', 
                        items: { type: 'string' },
                        example: ['GET / (docs)', 'GET /health', 'POST /:projectId/:listName']
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      '/{projectId}/{listName}': {
        post: {
          summary: 'Append data to Google Sheet',
          description: 'Append data to a specific sheet range in a configured Google Spreadsheet',
          tags: ['Data Management'],
          parameters: [
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: { type: 'string' },
              example: 'motobarn'
            },
            {
              name: 'listName',
              in: 'path',
              required: true,
              schema: { type: 'string' },
              example: 'leads'
            }
          ],
          requestBody: {
            description: 'Data to append to the sheet',
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: {
                      oneOf: [
                        { 
                          type: 'object',
                          additionalProperties: true,
                          example: { 
                            timestamp: '2024-01-15T10:30:00Z',
                            name: 'John Doe', 
                            email: 'john@example.com',
                            phone: '+1234567890',
                            motorcycle: 'Yamaha MT-07',
                            rental_type: 'daily',
                            rental_start: '2024-01-20',
                            rental_end: '2024-01-22',
                            pickup_time: '09:00',
                            dropoff_time: '18:00',
                            riding_mode: 'street',
                            addons: 'helmet,gloves',
                            pickup_dropoff_option: 'delivery',
                            final_price: 150.00
                          }
                        },
                        {
                          type: 'array',
                          items: {
                            type: 'object',
                            additionalProperties: true
                          },
                          example: [
                            { 
                              timestamp: '2024-01-15T10:30:00Z',
                              name: 'John Doe', 
                              email: 'john@example.com',
                              phone: '+1234567890',
                              motorcycle: 'Yamaha MT-07',
                              rental_type: 'daily',
                              rental_start: '2024-01-20',
                              rental_end: '2024-01-22',
                              pickup_time: '09:00',
                              dropoff_time: '18:00',
                              riding_mode: 'street',
                              addons: 'helmet,gloves',
                              pickup_dropoff_option: 'delivery',
                              final_price: 150.00
                            },
                            { 
                              timestamp: '2024-01-15T11:45:00Z',
                              name: 'Jane Smith', 
                              email: 'jane@example.com',
                              phone: '+0987654321',
                              motorcycle: 'Honda CB650R',
                              rental_type: 'weekly',
                              rental_start: '2024-01-25',
                              rental_end: '2024-02-01',
                              pickup_time: '10:00',
                              dropoff_time: '17:00',
                              riding_mode: 'touring',
                              addons: 'helmet,jacket,boots',
                              pickup_dropoff_option: 'pickup',
                              final_price: 420.00
                            }
                          ]
                        }
                      ]
                    }
                  },
                  required: ['data']
                }
              }
            }
          },
          responses: {
            '200': {
              description: 'Data successfully appended',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      ok: { type: 'boolean', example: true },
                      written: { type: 'number', example: 1 }
                    }
                  }
                }
              }
            },
            '400': {
              description: 'Invalid request payload',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      ok: { type: 'boolean', example: false },
                      error: { type: 'string', example: 'invalid_payload' },
                      detail: { type: 'string' }
                    }
                  }
                }
              }
            },
            '502': {
              description: 'Failed to append data to sheet',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      ok: { type: 'boolean', example: false },
                      error: { type: 'string', example: 'append_failed' },
                      detail: { type: 'string', example: 'Invalid spreadsheet ID' }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    tags: [
      {
        name: 'Health',
        description: 'Health check endpoints'
      },
      {
        name: 'Data Management',
        description: 'Operations for managing sheet data'
      }
    ]
  }

  return c.json(openApiSpec)
})



export default app
