# n8n Integration Guide for LiteAPI MCP Server

## Quick Fix for "File or directory does not exist" Error

The error occurs because n8n can't find the `liteapi-mcp-server` executable. Here are the solutions:

## Solution 1: Use Full Path (Recommended)

Instead of just `liteapi-mcp-server`, use the full path to the executable:

### Find the correct path:
```bash
which liteapi-mcp-server
```

### Common paths:
- **macOS/Linux with nvm**: `/Users/username/.nvm/versions/node/v21.7.1/bin/liteapi-mcp-server`
- **macOS with Homebrew**: `/usr/local/bin/liteapi-mcp-server`
- **Linux**: `/usr/bin/liteapi-mcp-server` or `/usr/local/bin/liteapi-mcp-server`

### In n8n MCP node configuration:
- **Command**: Use the full path (e.g., `/Users/username/.nvm/versions/node/v21.7.1/bin/liteapi-mcp-server`)
- **Working Directory**: Leave empty or set to `/`
- **Environment Variables**: Add `LITEAPI_API_KEY=your_api_key_here`

## Solution 2: Install Globally and Use PATH

### Install globally:
```bash
npm install -g liteapi-mcp-server@latest
```

### Verify installation:
```bash
which liteapi-mcp-server
liteapi-mcp-server --version
```

### In n8n MCP node configuration:
- **Command**: `liteapi-mcp-server`
- **Working Directory**: Leave empty
- **Environment Variables**: Add `LITEAPI_API_KEY=your_api_key_here`

## Solution 3: Use Node.js Directly

If the binary doesn't work, use Node.js directly:

### Find the package installation:
```bash
npm list -g liteapi-mcp-server
```

### In n8n MCP node configuration:
- **Command**: `node`
- **Arguments**: `/path/to/liteapi-mcp-server/dist/index.js`
- **Working Directory**: Leave empty
- **Environment Variables**: Add `LITEAPI_API_KEY=your_api_key_here`

## Solution 4: Local Installation

If you prefer not to install globally:

### Install locally in your project:
```bash
npm install liteapi-mcp-server
```

### In n8n MCP node configuration:
- **Command**: `node`
- **Arguments**: `./node_modules/liteapi-mcp-server/dist/index.js`
- **Working Directory**: Your project directory
- **Environment Variables**: Add `LITEAPI_API_KEY=your_api_key_here`

## Testing the Configuration

### Test the MCP server manually:
```bash
# Test with full path
/Users/username/.nvm/versions/node/v21.7.1/bin/liteapi-mcp-server

# Or test with node
node /Users/username/.nvm/versions/node/v21.7.1/lib/node_modules/liteapi-mcp-server/dist/index.js
```

The server should start and wait for input (this is normal behavior for MCP servers).

## n8n MCP Node Configuration Examples

### Using @coleam/n8n-nodes-mcp:

```json
{
  "name": "LiteAPI Hotel Search",
  "type": "@coleam/n8n-nodes-mcp.mcp",
  "parameters": {
    "serverCommand": "/Users/username/.nvm/versions/node/v21.7.1/bin/liteapi-mcp-server",
    "serverArgs": [],
    "serverCwd": "/",
    "serverEnv": {
      "LITEAPI_API_KEY": "your_api_key_here"
    },
    "toolName": "search-hotels",
    "toolArguments": {
      "checkin": "2024-01-15",
      "checkout": "2024-01-20",
      "guests": 2,
      "rooms": 1,
      "location": "New York"
    }
  }
}
```

### Using @mseep/n8n-nodes-mcp:

```json
{
  "name": "LiteAPI MCP",
  "type": "@mseep/n8n-nodes-mcp.mcp",
  "parameters": {
    "command": "/Users/username/.nvm/versions/node/v21.7.1/bin/liteapi-mcp-server",
    "cwd": "/",
    "env": {
      "LITEAPI_API_KEY": "your_api_key_here"
    },
    "operation": "executeTool",
    "toolName": "search-hotels",
    "arguments": {
      "checkin": "2024-01-15",
      "checkout": "2024-01-20",
      "guests": 2,
      "rooms": 1,
      "location": "New York"
    }
  }
}
```

## Troubleshooting

### Error: "The file or directory does not exist"
- **Cause**: n8n can't find the executable
- **Fix**: Use the full path to the executable

### Error: "Permission denied"
- **Cause**: The executable doesn't have execute permissions
- **Fix**: Run `chmod +x /path/to/liteapi-mcp-server`

### Error: "Command failed"
- **Cause**: Missing dependencies or wrong Node.js version
- **Fix**: Ensure Node.js 18+ is installed and dependencies are available

### Error: "API key not found"
- **Cause**: Environment variable not set
- **Fix**: Add `LITEAPI_API_KEY` to the environment variables in n8n

## Available Tools

Once configured, you can use these tools in your n8n workflows:

- `search-hotels` - Search for hotels
- `search-hotels-by-geo` - Search hotels by coordinates
- `create-booking` - Create a hotel booking
- `get-booking` - Retrieve booking details
- `cancel-booking` - Cancel a booking
- `get-most-booked-hotels` - Get analytics
- `get-countries` - Get country list
- `get-cities` - Get city list
- And many more...

## Support

If you continue to have issues:
1. Check the n8n logs for detailed error messages
2. Verify the MCP server works outside of n8n
3. Ensure all environment variables are set correctly
4. Check that the Node.js version is compatible (18+)
