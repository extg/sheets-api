import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { Scalar } from '@scalar/hono-api-reference'

import type { 
  Env, 
  AppendPayload, 
  AppendResponse, 
  ReadResponse,
  ProjectConfig 
} from './types'
import { 
  AppendPayloadSchema
} from './types'
import { appendToSheet, readFromSheet } from './sheets'

const app = new Hono<Env>()

// CORS middleware
app.use('*', async (c, next) => {
  const allowedOrigins = c.env.ALLOWED_ORIGINS || '*'
  c.header('Access-Control-Allow-Origin', allowedOrigins)
  c.header('Access-Control-Allow-Headers', 'content-type')
  c.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  
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
    version: '2.1.0',
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
        'GET  /:projectId/:listName',
        'POST /:projectId/:listName',
        'GET  /direct/:sheetId/:range',
        'POST /direct/:sheetId/:range',
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

// Direct endpoint - using sheetId and range directly
app.post(
  '/direct/:sheetId/:range',
  zValidator('json', AppendPayloadSchema),
  async (c) => {
    const startTime = Date.now()
    const sheetId = c.req.param('sheetId')
    const range = decodeURIComponent(c.req.param('range'))
    
    try {
      const body = c.req.valid('json')

      const saEmail = c.env.SA_EMAIL
      const saPrivateKey = c.env.SA_PRIVATE_KEY

      if (!saEmail || !saPrivateKey) {
        throw new Error('Service account credentials not configured')
      }

      // Normalize data to array of objects
      const items = Array.isArray(body.data) ? body.data : [body.data]

      // Append to sheet using google-spreadsheet library
      const result = await appendToSheet(
        sheetId,
        range,
        items,
        saEmail,
        saPrivateKey
      )

      const duration = Date.now() - startTime
      
      console.log(`[${new Date().toISOString()}] SUCCESS - direct: ${sheetId}/${range}, written: ${result.written}, duration: ${duration}ms`)

      return c.json<AppendResponse>({ 
        ok: true, 
        written: result.written
      })

    } catch (error) {
      const duration = Date.now() - startTime
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      
      console.log(`[${new Date().toISOString()}] ERROR - direct: ${sheetId}/${range}, error: ${errorMessage}, duration: ${duration}ms`)
      
      return c.json<AppendResponse>({ 
        ok: false, 
        error: 'append_failed',
        detail: errorMessage
      }, 502)
    }
  }
)

// GET endpoint for project-based reading
app.get(
  '/:projectId/:listName',
  async (c) => {
    const startTime = Date.now()
    const projectId = c.req.param('projectId')
    const listName = c.req.param('listName')
    const format = c.req.query('format') as 'raw' | 'objects' || 'objects'
    
    try {
      const config = resolveSheetConfig(projectId, listName, c.env)

      // Read from sheet
      const result = await readFromSheet(
        config.sheetId,
        config.range,
        config.saEmail,
        config.saPrivateKey,
        format
      )

      const duration = Date.now() - startTime
      
      console.log(`[${new Date().toISOString()}] SUCCESS - read project: ${projectId}, list: ${listName}, count: ${result.count}, duration: ${duration}ms`)

      return c.json<ReadResponse>({ 
        ok: true, 
        data: result.data,
        count: result.count
      })

    } catch (error) {
      const duration = Date.now() - startTime
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      
      console.log(`[${new Date().toISOString()}] ERROR - read project: ${projectId}, list: ${listName}, error: ${errorMessage}, duration: ${duration}ms`)
      
      return c.json<ReadResponse>({ 
        ok: false, 
        error: 'read_failed',
        detail: errorMessage
      }, 502)
    }
  }
)

// GET endpoint for direct reading
app.get(
  '/direct/:sheetId/:range',
  async (c) => {
    const startTime = Date.now()
    const sheetId = c.req.param('sheetId')
    const range = decodeURIComponent(c.req.param('range'))
    const format = c.req.query('format') as 'raw' | 'objects' || 'objects'
    
    try {
      const saEmail = c.env.SA_EMAIL
      const saPrivateKey = c.env.SA_PRIVATE_KEY

      if (!saEmail || !saPrivateKey) {
        throw new Error('Service account credentials not configured')
      }

      // Read from sheet
      const result = await readFromSheet(
        sheetId,
        range,
        saEmail,
        saPrivateKey,
        format
      )

      const duration = Date.now() - startTime
      
      console.log(`[${new Date().toISOString()}] SUCCESS - read direct: ${sheetId}/${range}, count: ${result.count}, duration: ${duration}ms`)

      return c.json<ReadResponse>({ 
        ok: true, 
        data: result.data,
        count: result.count
      })

    } catch (error) {
      const duration = Date.now() - startTime
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      
      console.log(`[${new Date().toISOString()}] ERROR - read direct: ${sheetId}/${range}, error: ${errorMessage}, duration: ${duration}ms`)
      
      return c.json<ReadResponse>({ 
        ok: false, 
        error: 'read_failed',
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
      version: '2.1.0',
      description: 'Universal Google Sheets API service with auto-mapping support. This API allows you to read from and write to Google Sheets through pre-configured projects and ranges.'
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
        get: {
          summary: 'Read data from Google Sheet',
          description: 'Read data from a specific sheet range in a configured Google Spreadsheet',
          tags: ['Data Management'],
          parameters: [
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: { type: 'string' },
              example: 'myproject'
            },
            {
              name: 'listName',
              in: 'path',
              required: true,
              schema: { type: 'string' },
              example: 'contacts'
            },
            {
              name: 'format',
              in: 'query',
              required: false,
              schema: { 
                type: 'string',
                enum: ['raw', 'objects'],
                default: 'objects'
              },
              description: 'Response format: "raw" returns 2D array, "objects" returns array of objects with headers as keys'
            }
          ],
          responses: {
            '200': {
              description: 'Data successfully retrieved',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      ok: { type: 'boolean', example: true },
                      data: {
                        oneOf: [
                          {
                            type: 'array',
                            items: {
                              type: 'array',
                              items: { type: 'string' }
                            },
                            description: 'Raw format: 2D array of values'
                          },
                          {
                            type: 'array',
                            items: {
                              type: 'object',
                              additionalProperties: true
                            },
                            description: 'Objects format: array of objects with headers as keys'
                          }
                        ]
                      },
                      count: { type: 'number', example: 5 }
                    }
                  }
                }
              }
            },
            '502': {
              description: 'Failed to read data from sheet',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      ok: { type: 'boolean', example: false },
                      error: { type: 'string', example: 'read_failed' },
                      detail: { type: 'string', example: 'Project not found or invalid sheet ID' }
                    }
                  }
                }
              }
            }
          }
        },
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
              example: 'myproject'
            },
            {
              name: 'listName',
              in: 'path',
              required: true,
              schema: { type: 'string' },
              example: 'contacts'
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
                            company: 'Acme Corp',
                            job_title: 'Developer',
                            source: 'website',
                            message: 'Interested in your services',
                            budget: 5000,
                            priority: 'high'
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
                              company: 'Acme Corp',
                              job_title: 'Developer',
                              source: 'website',
                              message: 'Interested in your services',
                              budget: 5000,
                              priority: 'high'
                            },
                            { 
                              timestamp: '2024-01-15T11:45:00Z',
                              name: 'Jane Smith', 
                              email: 'jane@example.com',
                              phone: '+0987654321',
                              company: 'Tech Solutions',
                              job_title: 'Product Manager',
                              source: 'referral',
                              message: 'Looking for consulting services',
                              budget: 10000,
                              priority: 'medium'
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
      },
      '/direct/{sheetId}/{range}': {
        get: {
          summary: 'Read data directly from Google Sheet',
          description: 'Read data directly from a specific sheet using sheetId and range, bypassing project configuration',
          tags: ['Data Management'],
          parameters: [
            {
              name: 'sheetId',
              in: 'path',
              required: true,
              schema: { type: 'string' },
              description: 'Google Sheets document ID',
              example: '1ABC123XYZ456...'
            },
            {
              name: 'range',
              in: 'path',
              required: true,
              schema: { type: 'string' },
              description: 'Sheet range (URL encoded)',
              example: 'Sheet1!A:Z'
            },
            {
              name: 'format',
              in: 'query',
              required: false,
              schema: { 
                type: 'string',
                enum: ['raw', 'objects'],
                default: 'objects'
              },
              description: 'Response format: "raw" returns 2D array, "objects" returns array of objects with headers as keys'
            }
          ],
          responses: {
            '200': {
              description: 'Data successfully retrieved',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      ok: { type: 'boolean', example: true },
                      data: {
                        oneOf: [
                          {
                            type: 'array',
                            items: {
                              type: 'array',
                              items: { type: 'string' }
                            },
                            description: 'Raw format: 2D array of values'
                          },
                          {
                            type: 'array',
                            items: {
                              type: 'object',
                              additionalProperties: true
                            },
                            description: 'Objects format: array of objects with headers as keys'
                          }
                        ]
                      },
                      count: { type: 'number', example: 5 }
                    }
                  }
                }
              }
            },
            '502': {
              description: 'Failed to read data from sheet',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      ok: { type: 'boolean', example: false },
                      error: { type: 'string', example: 'read_failed' },
                      detail: { type: 'string', example: 'Invalid spreadsheet ID' }
                    }
                  }
                }
              }
            }
          }
        },
        post: {
          summary: 'Append data directly to Google Sheet',
          description: 'Append data directly to a specific sheet using sheetId and range, bypassing project configuration',
          tags: ['Data Management'],
          parameters: [
            {
              name: 'sheetId',
              in: 'path',
              required: true,
              schema: { type: 'string' },
              description: 'Google Sheets document ID',
              example: '1ABC123XYZ456...'
            },
            {
              name: 'range',
              in: 'path',
              required: true,
              schema: { type: 'string' },
              description: 'Sheet range (URL encoded)',
              example: 'Sheet1!A:Z'
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
                            company: 'Acme Corp',
                            job_title: 'Developer',
                            source: 'website',
                            message: 'Interested in your services',
                            budget: 5000,
                            priority: 'high'
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
                              company: 'Acme Corp',
                              message: 'Direct API usage example'
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
