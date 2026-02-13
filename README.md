# LiteAPI MCP Server

A production-ready Model Context Protocol (MCP) server for LiteAPI, providing access to hotel search, booking, analytics, and other travel-related APIs through MCP-compliant tools.

## Features

- ✅ **MCP 2025-11-25 Specification Compliant** - Uses latest MCP SDK (v1.26.0)
- ✅ **OAuth 2.1 Authorization Support** - Implements Protected Resource Metadata discovery (RFC9728)
- ✅ **Multiple Authentication Methods** - Bearer tokens, API keys, query parameters
- ✅ **Production Ready** - Structured logging, error handling, health checks
- ✅ **Dual Transport Modes** - STDIO for local development, SSE for remote deployment
- ✅ **OpenAPI Tool Generation** - Automatically generates MCP tools from OpenAPI schemas

## Development

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Run in HTTP mode (for remote access)

```bash
npm run dev
```

Server will start on `http://localhost:3000`

### Run in stdio mode (for local Claude Desktop)

```bash
npm run dev:stdio
```

### Run server and inspector

```bash
npm run inspect
```

This runs the MCP inspector tool for debugging and testing.

## Production

### Build and run in HTTP mode

```bash
npm run build
npm start
```

### Build and run in stdio mode

```bash
npm run build
npm run start:stdio
```

---

## Configure with Claude Desktop

### Local Configuration (stdio mode)

Add to your Claude Desktop configuration (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "liteapi": {
      "command": "/path/to/node",
      "cwd": "/path/to/mcp-server",
      "args": [
        "/path/to/mcp-server/dist/index.js",
        "--stdio"
      ],
      "env": {
        "MCP_MODE": "stdio",
        "LITEAPI_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

### Remote Configuration (HTTP mode with OAuth 2.1)

For production deployments, use the HTTP/SSE transport with Bearer token authentication:

```json
{
  "mcpServers": {
    "liteapi": {
      "url": "https://your-vercel-app.vercel.app/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_LITEAPI_KEY"
      }
    }
  }
}
```

**Note:** The server supports multiple authentication methods (see Authentication section below).

## Authentication

The MCP server implements OAuth 2.1-compliant authentication with Protected Resource Metadata discovery. Authentication is **required** for all HTTP/SSE connections.

### Supported Authentication Methods

1. **Authorization Bearer Token** (Recommended - OAuth 2.1 compliant):
   ```
   Authorization: Bearer YOUR_LITEAPI_KEY
   ```
   This is the preferred method for production deployments.

2. **X-Api-Key Header** (Backward compatible):
   ```
   X-Api-Key: YOUR_LITEAPI_KEY
   ```

3. **Query Parameter** (Less secure, for testing only):
   ```
   https://your-app.vercel.app/mcp?apiKey=YOUR_LITEAPI_KEY
   ```

### Protected Resource Metadata Discovery

The server implements OAuth 2.0 Protected Resource Metadata (RFC9728) for authorization server discovery:

- **Well-known endpoint**: `/.well-known/oauth-protected-resource`
- **MCP-specific endpoint**: `/.well-known/oauth-protected-resource/mcp`

When authentication fails, the server returns a `401 Unauthorized` response with a `WWW-Authenticate` header containing:
- `resource_metadata` - URL to the Protected Resource Metadata document
- `scope` - Required scopes for accessing the resource

Example 401 response:
```
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer resource_metadata="https://your-app.vercel.app/.well-known/oauth-protected-resource/mcp", scope="liteapi:read liteapi:write"
```

### Session Management

- API keys are stored per session (in-memory)
- Sessions are automatically cleaned up after 24 hours
- Each SSE connection gets a unique session ID

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `LITEAPI_API_KEY` | Your LiteAPI API key (defaults to sandbox key for stdio mode only) | `sand_c0155ab8-c683-4f26-8f94-b5e92c5797b9` |
| `MCP_MODE` | Transport mode: `stdio` for local, `http` for remote | `http` |
| `PORT` | Port for HTTP server | `3000` |
| `NODE_ENV` | Environment: `development` or `production` | `development` |
| `VERCEL` | Set by Vercel platform | - |

## API Endpoints

### Health Check

```
GET /health
```

Returns server status and uptime information.

### MCP SSE Endpoint

```
GET /mcp
```

Establishes an SSE connection for MCP protocol communication. Requires authentication.

### Protected Resource Metadata

```
GET /.well-known/oauth-protected-resource
GET /.well-known/oauth-protected-resource/mcp
```

Returns OAuth 2.0 Protected Resource Metadata (RFC9728) for authorization server discovery.

## Deployment

### Vercel Deployment (Recommended)

This server is configured to deploy to Vercel:

1. **Install Vercel CLI** (if not already installed):
   ```bash
   npm i -g vercel
   ```

2. **Deploy**:
   ```bash
   vercel
   ```

3. **Production Deployment**:
   ```bash
   vercel --prod
   ```

The server will be available at `https://your-project.vercel.app/mcp`

**Important Notes:**
- Vercel serverless functions have execution time limits. For long-running SSE connections, consider upgrading to Vercel Pro/Enterprise.
- Each MCP connection requires authentication via API key (see Authentication section above).
- The server automatically detects Vercel environment and exports the Express app correctly.

### Docker Deployment

Build and run with Docker:

```bash
docker build -t liteapi-mcp-server .
docker run -p 3000:3000 -e LITEAPI_API_KEY=your-key liteapi-mcp-server
```

### AWS Copilot Deployment (Alternative)

This server can also be deployed to AWS using Copilot with:
- Load Balanced Web Service for HTTP access
- Health check endpoint at `/health`
- MCP endpoint at `/mcp`
- Environment-specific domains for staging and production

## Production Considerations

### Security

- ✅ Bearer token authentication (OAuth 2.1 compliant)
- ✅ Protected Resource Metadata discovery
- ✅ Proper error handling with OAuth-compliant error responses
- ✅ Session-based API key storage (in-memory)
- ⚠️ For production, consider implementing:
  - Token validation and expiration
  - Rate limiting
  - Request signing/verification
  - API key rotation support

### Monitoring

- Structured logging with timestamps and request/response details
- Health check endpoint for monitoring systems
- Error tracking with stack traces (development mode only)

### Performance

- Session cleanup after 24 hours
- Efficient in-memory session storage
- SSE transport for real-time communication

### Scaling

- Stateless design (except session storage)
- Can be horizontally scaled behind a load balancer
- Consider Redis for shared session storage in multi-instance deployments

## Troubleshooting

### Connection Issues

1. **401 Unauthorized**: Ensure you're providing an API key via one of the supported methods
2. **Connection timeout**: Check firewall settings and ensure SSE connections are allowed
3. **Schema loading errors**: Verify `openapi-schemas/` directory exists and contains all required JSON files

### Development Issues

1. **TypeScript errors**: Run `npm run build` to check for compilation errors
2. **SDK version mismatch**: Ensure `@modelcontextprotocol/sdk` is at version 1.26.0 or later
3. **Port already in use**: Change `PORT` environment variable or stop the conflicting service

## License

ISC
