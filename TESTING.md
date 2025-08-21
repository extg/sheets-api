# Testing the GET Functionality

## Prerequisites

1. Set up Google Service Account credentials in `wrangler.toml` or environment variables
2. Configure `PROJECTS_CONFIG` with your sheet IDs and ranges
3. Ensure your Google Sheet has data with headers in the first row

## Local Testing

```bash
# Start the development server
npm run dev

# Test health endpoint (should show new GET endpoints)
curl http://localhost:8787/health

# Test reading data - project mode (objects format)
curl http://localhost:8787/your-project/your-list

# Test reading data - project mode (raw format)
curl "http://localhost:8787/your-project/your-list?format=raw"

# Test reading data - direct mode
curl http://localhost:8787/direct/YOUR_SHEET_ID/Sheet1%21A%3AZ

# Test reading data - direct mode (raw format)
curl "http://localhost:8787/direct/YOUR_SHEET_ID/Sheet1%21A%3AZ?format=raw"
```

## Expected Responses

### Objects Format (default)
```json
{
  "ok": true,
  "data": [
    {
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "+1234567890"
    },
    {
      "name": "Jane Smith", 
      "email": "jane@example.com",
      "phone": "+0987654321"
    }
  ],
  "count": 2
}
```

### Raw Format
```json
{
  "ok": true,
  "data": [
    ["name", "email", "phone"],
    ["John Doe", "john@example.com", "+1234567890"],
    ["Jane Smith", "jane@example.com", "+0987654321"]
  ],
  "count": 3
}
```

### Error Response
```json
{
  "ok": false,
  "error": "read_failed",
  "detail": "Project not found or invalid sheet ID"
}
```

## API Documentation

Visit `http://localhost:8787/` to see the interactive API documentation with all the new GET endpoints.

## Notes

- The `format` query parameter is optional and defaults to `objects`
- Empty sheets will return `{"ok": true, "data": [], "count": 0}`
- Sheets with only headers will return empty data array but count will include the header row
- All existing POST functionality remains unchanged