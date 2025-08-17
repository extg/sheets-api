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

**Single Required Endpoint:**

```bash
# Project with specific list (both parameters required)
POST /:projectId/:listName
```

**Example Requests:**

```bash
# Send to project1, leads list
curl -X POST https://your-worker.workers.dev/project1/leads \
  -H "Content-Type: application/json" \
  -d '{
    "data": {
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "+1234567890",
      "utm_source": "facebook"
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

# Projects configuration in JSON format
PROJECTS_CONFIG = '''
{
  "project1": {
    "sheetId": "1XyZ...project2_sheet_id...",
    "ranges": {
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

- `GET /` - Health check and endpoint list
- `POST /:projectId/:listName` - Append to specific list

### POST /:projectId/:listName

Appends data to a specific list within the project.

**Request Body:**
```json
{
  "data": {
    // Single object or array of objects
    "field1": "value1",
    "field2": "value2"
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
  "error": "Project \"unknown\" not found"
}
```

**Status Codes:**
- `200` - Success
- `400` - Invalid payload, project not found, or list not found
- `502` - Google Sheets API error

---

## Advanced Configuration

### Project Configuration Structure

Each project in `PROJECTS_CONFIG` can have:

```json
{
  "projectId": {
    "sheetId": "required_google_sheet_id",
    "ranges": {
      "listName1": "Sheet1!A:Z",
      "listName2": "Sheet2!A:Z"
    }
  }
}
```

### Configuration Priority

1. **URL Parameters**: `/:projectId/:listName` - defines which project and list to use
2. **Project Config**: From `PROJECTS_CONFIG` JSON - defines sheet ID and ranges
3. **No Fallbacks**: All projects and lists must be explicitly configured

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
# Project1 leads
POST /project1/leads
→ Goes to "Leads!A:Z" sheet in project1's Google Sheet

# Project1 orders  
POST /project1/orders
→ Goes to "Orders!A:Z" sheet in project1's Google Sheet

# Project2 subscribers
POST /project2/subscribers  
→ Goes to "Subscribers!A:Z" sheet in project2's Google Sheet

# All endpoints require both project and list
# No fallbacks or defaults
```

### Frontend Integration

```javascript
// React/Next.js example
const submitLead = async (formData) => {
  const response = await fetch('https://your-worker.workers.dev/project1/leads', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: formData })
  })
  
  const result = await response.json()
  return result
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
curl http://localhost:8787/

# Test project endpoint
curl -X POST http://localhost:8787/project1/leads \
  -H "Content-Type: application/json" \
  -d '{"data": {"test": "value"}}'
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

**"Project not found" Error**
- Verify project exists in `PROJECTS_CONFIG` JSON
- Check JSON syntax in wrangler.toml
- Ensure project slug matches exactly

**"List not found" Error**  
- Verify the list name exists in project's `ranges` object
- Check spelling and case sensitivity
- Remember: both project and list are required parameters

**"append_failed" Error**  
- Verify service account has access to the sheet
- Check that the SA_PRIVATE_KEY secret is set correctly
- Ensure Google Sheets API is enabled

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
