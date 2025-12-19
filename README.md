# LiteAPI MCP Server

## Development

### Run in HTTP mode (for remote access)
```bash
npm run dev
```

### Run in stdio mode (for local Claude Desktop)
```bash
npm run dev:stdio
```

### Run server and inspector
```bash
npm run inspect
```

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

## Configure with Claude

### Local Configuration (stdio mode)
```json
{
  "mcpServers": {
    "liteapi": {
      "command": "/Users/YOUR_USER/.nvm/versions/node/v18.18.2/bin/node",
      "cwd": "/Users/YOUR_USER/mcp-server",
      "args": [
        "/Users/YOUR_USER/mcp-server/dist/index.js",
        "--stdio"
      ],
      "env": {
        "MCP_MODE": "stdio"
      }
    }
  }
}
```

### Remote Configuration (HTTP mode)
```json
{
  "mcpServers": {
    "liteapi": {
      "url": "https://your-vercel-app.vercel.app/mcp?apiKey=YOUR_LITEAPI_KEY"
    }
  }
}
```

**Note:** When using HTTP mode, you must provide your LiteAPI API key as a query parameter (`?apiKey=YOUR_KEY`) or in the `X-Api-Key` header.

## Authentication

The MCP server requires authentication when deployed. Users must provide their LiteAPI API key in one of the following ways:

1. **Query Parameter** (recommended for MCP clients):
   ```
   https://your-app.vercel.app/mcp?apiKey=YOUR_LITEAPI_KEY
   ```

2. **HTTP Header**:
   ```
   X-Api-Key: YOUR_LITEAPI_KEY
   ```

3. **Authorization Header**:
   ```
   Authorization: Bearer YOUR_LITEAPI_KEY
   ```

The API key is stored per session and used for all API calls made through that MCP connection.

## Environment Variables

- `LITEAPI_API_KEY`: Your LiteAPI API key (defaults to sandbox key for stdio mode only)
- `MCP_MODE`: Set to "stdio" for local mode, "http" for remote mode
- `PORT`: Port for HTTP server (defaults to 3000)
- `LOG_LEVEL`: Logging level (defaults to "info")

## Deployment

### Vercel Deployment

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

### AWS Copilot Deployment (Alternative)

This server can also be deployed to AWS using Copilot with:
- Load Balanced Web Service for HTTP access
- Health check endpoint at `/health`
- MCP endpoint at `/mcp`
- Environment-specific domains for staging and production