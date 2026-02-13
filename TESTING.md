# Testing Guide for LiteAPI MCP Server

This guide covers multiple ways to test the MCP server, from quick smoke tests to full integration testing.

## Quick Start

### 1. Build the Server

```bash
npm run build
```

### 2. Test with MCP Inspector (Recommended)

The MCP Inspector is the official tool for testing MCP servers:

```bash
npm run inspect
```

This will:
- Build the server
- Launch the MCP Inspector
- Connect via stdio transport
- Allow you to interactively test tools and resources

**Note**: The inspector uses stdio mode, so it will use the default sandbox API key or `LITEAPI_API_KEY` environment variable.

## Testing Methods

### Method 1: MCP Inspector (Interactive Testing)

**Best for**: Testing tool registration, schema validation, and interactive exploration

```bash
# Build and run inspector
npm run inspect
```

The inspector provides a web UI where you can:
- View available tools
- Call tools with parameters
- See responses
- Debug protocol messages

### Method 2: HTTP Mode Testing (Manual)

**Best for**: Testing HTTP endpoints, authentication, and SSE connections

#### Start the Server

```bash
npm run dev
# or for production build
npm run build && npm start
```

The server will start on `http://localhost:3000`

#### Test Health Endpoint

```bash
curl http://localhost:3000/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2025-02-13T...",
  "version": "3.0.0",
  "uptime": 123.45
}
```

#### Test Protected Resource Metadata

```bash
curl http://localhost:3000/.well-known/oauth-protected-resource
```

Expected response:
```json
{
  "resource": "http://localhost:3000/mcp",
  "authorization_servers": [],
  "scopes_supported": ["liteapi:read", "liteapi:write"],
  "bearer_methods_supported": ["header"],
  "resource_documentation": "https://liteapi.travel/docs"
}
```

#### Test Authentication (401 Response)

```bash
curl -v http://localhost:3000/mcp
```

Expected response:
- Status: `401 Unauthorized`
- Header: `WWW-Authenticate: Bearer resource_metadata="...", scope="liteapi:read liteapi:write"`

#### Test with API Key (Query Parameter)

```bash
curl "http://localhost:3000/mcp?apiKey=YOUR_API_KEY" \
  -H "Accept: text/event-stream" \
  -N
```

**Note**: SSE connections require special handling. See "Testing SSE Connections" below.

### Method 3: Testing with cURL (SSE Connection)

**Best for**: Testing SSE transport and authentication

SSE connections are long-lived, so you'll need to handle them differently:

```bash
# Test with Bearer token (recommended)
curl -N -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Accept: text/event-stream" \
  http://localhost:3000/mcp

# Test with X-Api-Key header
curl -N -H "X-Api-Key: YOUR_API_KEY" \
  -H "Accept: text/event-stream" \
  http://localhost:3000/mcp

# Test with query parameter (less secure)
curl -N "http://localhost:3000/mcp?apiKey=YOUR_API_KEY" \
  -H "Accept: text/event-stream"
```

The `-N` flag disables buffering, and `Accept: text/event-stream` tells the server to use SSE.

### Method 4: Testing with Node.js Script

**Best for**: Automated testing and integration tests

Create a test script:

```javascript
// test/mcp-client-test.js
const { SSEClientTransport } = require('@modelcontextprotocol/sdk/client/sse.js');
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');

async function testMCP() {
  const transport = new SSEClientTransport(
    new URL('http://localhost:3000/mcp'),
    {
      headers: {
        'Authorization': 'Bearer YOUR_API_KEY'
      }
    }
  );

  const client = new Client({
    name: 'test-client',
    version: '1.0.0'
  }, {
    capabilities: {}
  });

  await client.connect(transport);

  // List available tools
  const tools = await client.listTools();
  console.log('Available tools:', tools);

  // Call a tool
  const result = await client.callTool({
    name: 'complete-booking',
    arguments: {
      hotelId: 'lp39590',
      checkin: '2025-12-29',
      checkout: '2025-12-30',
      rooms: 1,
      adults: 2,
      children: 0,
      name: 'London'
    }
  });

  console.log('Tool result:', result);
  
  await client.close();
}

testMCP().catch(console.error);
```

### Method 5: Testing with Claude Desktop

**Best for**: Real-world usage testing

1. **Configure Claude Desktop**:

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or equivalent on your OS:

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

2. **Restart Claude Desktop**

3. **Test in Claude**: Ask Claude to use LiteAPI tools, e.g., "Search for hotels in London"

### Method 6: Testing Authentication Methods

**Test Bearer Token (OAuth 2.1 compliant)**:
```bash
curl -v -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Accept: text/event-stream" \
  -N http://localhost:3000/mcp
```

**Test X-Api-Key Header**:
```bash
curl -v -H "X-Api-Key: YOUR_API_KEY" \
  -H "Accept: text/event-stream" \
  -N http://localhost:3000/mcp
```

**Test Query Parameter**:
```bash
curl -v "http://localhost:3000/mcp?apiKey=YOUR_API_KEY" \
  -H "Accept: text/event-stream" \
  -N
```

**Test Missing Authentication (should return 401)**:
```bash
curl -v http://localhost:3000/mcp
```

Expected: `401 Unauthorized` with `WWW-Authenticate` header

## Testing Checklist

### Basic Functionality
- [ ] Server starts without errors
- [ ] Health endpoint returns 200
- [ ] Protected Resource Metadata endpoint returns valid JSON
- [ ] MCP endpoint requires authentication (401 without key)
- [ ] MCP endpoint accepts Bearer token
- [ ] MCP endpoint accepts X-Api-Key header
- [ ] MCP endpoint accepts query parameter (backward compat)

### MCP Protocol
- [ ] Inspector can connect via stdio
- [ ] Inspector lists all tools
- [ ] Tools have correct schemas
- [ ] Can call tools with valid parameters
- [ ] Tools return expected responses
- [ ] Error handling works for invalid parameters

### Authentication & Authorization
- [ ] 401 response includes WWW-Authenticate header
- [ ] WWW-Authenticate includes resource_metadata URL
- [ ] WWW-Authenticate includes scope parameter
- [ ] All auth methods work (Bearer, X-Api-Key, query param)
- [ ] Invalid API keys are rejected

### Production Readiness
- [ ] Logging works correctly
- [ ] Error handling doesn't crash server
- [ ] Health check includes uptime
- [ ] Sessions are cleaned up after 24h
- [ ] Server handles concurrent connections

## Debugging Tips

### Enable Verbose Logging

Set environment variable:
```bash
NODE_ENV=development npm run dev
```

### Check Server Logs

The server logs all requests with:
- Timestamp
- Method and path
- Status code
- Duration

### Common Issues

1. **Port already in use**: Change `PORT` environment variable
2. **Schema loading errors**: Check `openapi-schemas/` directory exists
3. **Authentication fails**: Verify API key format and value
4. **SSE connection issues**: Ensure `Accept: text/event-stream` header is set

## Example Test Scenarios

### Scenario 1: Search for Hotels

```bash
# Using MCP Inspector
npm run inspect
# Then call: search-hotels-rates with parameters
```

### Scenario 2: Complete Booking

```bash
# Using MCP Inspector
npm run inspect
# Then call: complete-booking with:
# - hotelId: "lp39590"
# - checkin: "2025-12-29"
# - checkout: "2025-12-30"
# - rooms: 1
# - adults: 2
# - children: 0
# - name: "London"
```

### Scenario 3: Test Error Handling

```bash
# Call tool with invalid parameters
# Should return error response
```

## Next Steps

After basic testing:
1. Test with your actual LiteAPI API key
2. Test with real MCP clients (Claude Desktop, etc.)
3. Load test with multiple concurrent connections
4. Test error scenarios (invalid keys, network issues, etc.)
