# Universal Google Sheets API Service

A minimal, configurable API service built on **Hono + Cloudflare Workers** that accepts JSON data and writes it to Google Sheets through Service Account authentication. Now with **multi-project support**!

## Features

- **Multi-Project Support**: Configure multiple projects with different sheets and lists
- **Auto-mapping**: Automatically maps JSON fields to spreadsheet columns based on header row
- **Flexible URLs**: Project-based URLs with optional list names in the URL path
- **Service Account Auth**: Secure authentication using Google Service Account JWT
- **CORS Support**: Built-in CORS handling with configurable origins
- **High Performance**: Runs on Cloudflare Workers edge network with built-in caching
- **Modern Stack**: Built with google-spreadsheet library for reliability

---

## 🚀 Quick Start

**📋 Detailed Setup Guide**: [Complete setup instructions →](./docs/setup-guide.md)

### 1. Deploy to Cloudflare Workers

```bash
# Install dependencies
pnpm install

# Configure your environment variables
npx wrangler secret put SA_PRIVATE_KEY
# Paste your Google Service Account private key

# Deploy
pnpm deploy
```

### 2. API Usage

**Available Endpoints:**

```bash
# Project-based endpoint (uses PROJECT_CONFIG aliases)
POST /:projectId/:listName

# Direct endpoint (bypasses PROJECT_CONFIG, uses direct parameters)
POST /direct/:sheetId/:range
```

**Example Requests:**

```bash
# Option 1: Project-based approach (using configured aliases)
curl -X POST https://your-worker.workers.dev/myproject/contacts \
  -H "Content-Type: application/json" \
  -d '{
    "data": {
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "+1234567890",
      "company": "Acme Corp",
      "source": "website"
    }
  }'

# Option 2: Direct approach (bypassing PROJECT_CONFIG)
curl -X POST https://your-worker.workers.dev/direct/1ABC123XYZ.../Sheet1%21A%3AZ \
  -H "Content-Type: application/json" \
  -d '{
    "data": {
      "name": "John Doe",
      "email": "john@example.com",
      "company": "Acme Corp"
    }
  }'
```

**Example Response:**
```json
{
  "ok": true,
  "written": 1
}
```

---

## Configuration

### Environment Variables (wrangler.toml)

```toml
[vars]
# Global configuration
SA_EMAIL = "service-account@project.iam.gserviceaccount.com"
ALLOWED_ORIGINS = "*"

# Projects configuration in JSON format (optional for direct usage)
PROJECTS_CONFIG = '''
{
  "myproject": {
    "sheetId": "1ABC123XYZ456...",
    "ranges": {
      "contacts": "Contacts!A:Z",
      "leads": "Leads!A:Z",
      "orders": "Orders!A:Z"
    }
  }
}
'''
```

### Secrets (using wrangler CLI)

```bash
npx wrangler secret put SA_PRIVATE_KEY
```

---

## API Reference

### Available Endpoints

- `GET /` - Interactive API documentation (Swagger UI)
- `GET /health` - Health check and endpoint list
- `POST /:projectId/:listName` - Append to project-configured list
- `POST /direct/:sheetId/:range` - Append directly to sheet (bypasses project config)
- `GET /openapi` - OpenAPI specification

### POST /:projectId/:listName

Appends data to a specific list within the project using PROJECT_CONFIG aliases.

### POST /direct/:sheetId/:range

Appends data directly to a Google Sheet using sheetId and range, bypassing project configuration. The range parameter should be URL encoded (e.g., `Sheet1%21A%3AZ` for `Sheet1!A:Z`).

**Request Body (both endpoints):**
```json
{
  "data": {
    // Single object or array of objects
    "name": "John Doe",
    "email": "john@example.com",
    "company": "Acme Corp",
    "source": "website"
  }
}
```

**Response (Success):**
```json
{
  "ok": true,
  "written": 2
}
```

**Response (Error):**
```json
{
  "ok": false,
  "error": "append_failed",
  "detail": "Project not found or invalid sheet ID"
}
```

**Status Codes:**
- `200` - Success
- `400` - Invalid payload, validation error
- `502` - Google Sheets API error, project/list not found, or authentication error

---

## Advanced Configuration

### Project Configuration Structure

Each project in `PROJECTS_CONFIG` can have:

```json
{
  "projectId": {
    "sheetId": "1ABC123XYZ456...",
    "ranges": {
      "contacts": "Contacts!A:Z",
      "leads": "Leads!A:Z",
      "orders": "Orders!A:Z"
    }
  }
}
```

### Configuration Priority

1. **Direct Mode**: `/direct/:sheetId/:range` - bypasses all configuration, uses direct parameters
2. **Project Mode**: `/:projectId/:listName` - uses PROJECT_CONFIG aliases
3. **Fallbacks**: Direct mode has no dependencies, project mode requires valid PROJECT_CONFIG

### Multiple Records

Send multiple records in a single request:

```json
{
  "data": [
    {"name": "John", "email": "john@example.com"},
    {"name": "Jane", "email": "jane@example.com"}
  ]
}
```

### Auto-mapping Behavior

The service automatically maps JSON fields to spreadsheet columns:

1. **With Headers**: If the first row contains headers, fields are mapped by name
2. **Without Headers**: Fields are written in alphabetical order of keys

**Example Sheet:**
```
| timestamp | name | email | phone | utm_source |
|-----------|------|-------|-------|------------|
| 2024-01-15 | John | john@example.com | +123 | facebook |
```

---

## URL Structure Examples

### Real-world Usage

```bash
# Project-based approach (configured aliases)
POST /myproject/contacts
→ Goes to configured "Contacts!A:Z" range in myproject's Google Sheet

POST /myproject/leads
→ Goes to configured "Leads!A:Z" range in myproject's Google Sheet

# Direct approach (no configuration needed)
POST /direct/1ABC123XYZ456.../Contacts%21A%3AZ
→ Goes directly to "Contacts!A:Z" in specified Google Sheet

POST /direct/1ABC123XYZ456.../Sheet1%21B2%3AF100
→ Goes directly to "Sheet1!B2:F100" range in specified Google Sheet
```

### Frontend Integration

```javascript
// React/Next.js example - Project mode
const submitContact = async (formData) => {
  const response = await fetch('https://your-worker.workers.dev/myproject/contacts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: formData })
  })
  return response.json()
}

// React/Next.js example - Direct mode
const submitDirect = async (formData) => {
  const sheetId = '1ABC123XYZ456...'
  const range = encodeURIComponent('Contacts!A:Z')
  const response = await fetch(`https://your-worker.workers.dev/direct/${sheetId}/${range}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: formData })
  })
  return response.json()
}
```

**See examples folder for complete implementations:**
- [HTML Form Example](./examples/frontend.html)
- [React Hook Example](./examples/react-hook.tsx)

---

## Google Sheets Setup

**📋 Detailed Setup Guide**: [Complete setup instructions →](./docs/setup-guide.md)

### Quick Overview

1. Create Google Service Account
2. Share your Google Sheet with the service account email
3. Configure environment variables in wrangler.toml
4. Deploy to Cloudflare Workers

---

## Development

### Local Development

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Type checking
pnpm type-check
```

### Testing

```bash
# Test health endpoint
curl http://localhost:8787/health

# Test project endpoint
curl -X POST http://localhost:8787/myproject/contacts \
  -H "Content-Type: application/json" \
  -d '{"data": {"name": "Test User", "email": "test@example.com"}}'

# Test direct endpoint
curl -X POST http://localhost:8787/direct/1ABC123XYZ.../Sheet1%21A%3AZ \
  -H "Content-Type: application/json" \
  -d '{"data": {"name": "Test User", "email": "test@example.com"}}'
```

---

## Deployment

### Production Deployment

```bash
# Deploy to Cloudflare Workers
pnpm deploy
```

### Environment Management

```bash
# List secrets
npx wrangler secret list

# Update secret
npx wrangler secret put SA_PRIVATE_KEY

# Update variables
# Edit wrangler.toml and redeploy
```

---

## Troubleshooting

### Common Issues

**"Project not found" Error** (Project mode only)
- Verify project exists in `PROJECTS_CONFIG` JSON
- Check JSON syntax in wrangler.toml
- Ensure project slug matches exactly
- Alternative: Use direct mode to bypass project configuration

**"List not found" Error** (Project mode only)
- Verify the list name exists in project's `ranges` object
- Check spelling and case sensitivity
- Alternative: Use direct mode with explicit range

**"append_failed" Error**  
- Verify service account has access to the sheet
- Check that the SA_PRIVATE_KEY secret is set correctly
- Ensure Google Sheets API is enabled
- For direct mode: verify sheetId format and range syntax

**Direct Mode Issues**
- Ensure sheetId is correct (from Google Sheets URL)
- URL encode range parameter (e.g., `Sheet1%21A%3AZ` for `Sheet1!A:Z`)
- Verify service account has access to the specific sheet

**CORS Issues**
- Update `ALLOWED_ORIGINS` in wrangler.toml
- Use specific domains instead of "*" for production

### Debug Mode

Check Cloudflare Workers logs for detailed error messages:

```bash
npx wrangler tail
```

---

## License

MIT License - feel free to use in your projects!

---

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

For bugs and feature requests, please open an issue on GitHub.
