# Changelog

## [2.1.0] - 2025-08-21

### Added
- **GET endpoint functionality** for reading data from Google Sheets
- Support for both project-based and direct sheet reading
- Multiple response formats:
  - `objects` format: Returns array of objects with headers as keys (default)
  - `raw` format: Returns 2D array of values including headers
- Query parameter `format` to control response format
- New `getValues()` method in WebCryptoSheetsClient class
- New `readFromSheet()` function with format support
- ReadResponse types and Zod schemas for validation
- Updated CORS middleware to support GET requests
- Complete OpenAPI specification for new GET endpoints
- Comprehensive documentation updates with examples

### Updated
- README with GET request examples and usage patterns
- API Reference documentation with new endpoints
- Frontend integration examples for reading data
- Testing section with read operation examples
- Health check endpoint now lists all available endpoints including GET methods

### Technical Details
- Added `ReadResponse`, `ReadSuccessResponse`, `ReadErrorResponse` types
- Enhanced error handling for read operations
- Consistent logging for both read and write operations
- Maintained backward compatibility with existing POST endpoints
- No new dependencies added - uses existing google-spreadsheet library

### Breaking Changes
None - all existing functionality remains unchanged.

## [2.0.0] - Previous Release
- Multi-project support
- Service Account authentication
- POST endpoints for writing data
- CORS support
- OpenAPI documentation