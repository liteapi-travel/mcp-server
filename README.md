# LiteAPI MCP Server

MCP server for LiteAPI using Next.js and mcp-handler (Streamable HTTP). Deploys to Vercel.

## Quick Start

```bash
npm install
npm run dev
```

MCP endpoint: `http://localhost:3000/api/mcp`

## ChatGPT Setup

Send the key on the `X-API-Key` header. The URL stays free of the secret:

```json
{
  "mcpServers": {
    "liteapi": {
      "url": "https://mcp.liteapi.travel/api/mcp",
      "headers": {
        "X-API-Key": "YOUR_LITEAPI_KEY"
      }
    }
  }
}
```

`?apiKey=` on the URL and `Authorization: Bearer` still work. Header wins if more than one is set.

For the local stdio server, set `LITEAPI_API_KEY` instead. There is no HTTP header on stdio.

With no key, sample calls use the shared sandbox key `sand_ca230deb-5a6b-42e7-bb72-869facd8892b`. That key only hits sandbox. Send `X-API-Key` to use your own key. `list_endpoints`, `describe_endpoint`, `search_docs`, `fetch_docs_page`, `search_dashboard_kb`, and `fetch_dashboard_feature` stay available either way. Dashboard-kb tools call `DASHBOARD_API_URL` (default `https://da.liteapi.travel`) for public Connect product guides.

OAuth is the path for Lovable, Claude, ChatGPT, and Cursor. The client uses this URL and leaves the client id empty. The browser approves the connection on the Nuitée Connect dashboard session. The resolve secret is built in and matches the dashboard API. Set `MCP_OAUTH_SERVICE_TOKEN` on both hosts only to replace that default. `DASHBOARD_API_URL` defaults to `https://da.liteapi.travel`.

```
https://mcp.liteapi.travel/api/mcp
```

---


## Features

- 🔄 **Dynamic Tool Generation**: Automatically generates MCP tools from OpenAPI specs
- 📚 **Multiple API Modules**: Supports Search, Booking, Vouchers, Analytics, Static, Loyalty, and Supply Customization APIs
- 🔐 **API key optional**: no key runs sample calls on the shared sandbox key. `X-API-Key`, `?apiKey=`, or `Authorization: Bearer` uses the caller's key.
- 🎯 **Type-Safe**: Uses Zod for schema validation and type safety
- 🚀 **Easy Integration**: Works with Claude Desktop and other MCP-compatible clients

## Prerequisites

- Node.js 18+
- npm or yarn
- LiteAPI API key, only if this process should execute live API calls

## Installation

1. Clone the repository and install dependencies:

```bash
npm install
```

2. Build the TypeScript code:

```bash
npm run build
```

3. Set your LiteAPI API key as an environment variable:

```bash
export LITEAPI_API_KEY=your_api_key_here
```

## Usage

### Running the Server

The server runs on stdio (standard input/output) for MCP communication:

```bash
npm start
```

Or for development with auto-reload:

```bash
npm run dev
```

## Testing

### Quick Test

Test that the server works correctly:

```bash
export LITEAPI_API_KEY=your_api_key_here
npm test
```

This will connect to the server and list all available tools.

### Option 1: Using MCP Inspector (Recommended for Development)

MCP Inspector is a browser-based tool for testing and debugging MCP servers. It's perfect for inspecting tools, testing calls, and debugging without needing Claude Desktop.

1. **Install and run MCP Inspector:**

```bash
# Make sure your API key is set
export LITEAPI_API_KEY=your_api_key_here

# Run the inspector (it will automatically start your server)
npm run inspect
# Or directly:
npx @modelcontextprotocol/inspector node dist/index.js
```

2. **The inspector will:**
   - Open a browser window at `http://localhost:6274`
   - Start a proxy server on port 6277
   - Display all available tools with their schemas
   - Allow you to test tool calls interactively
   - Show real-time notifications and responses

3. **In the Inspector UI, you can:**
   - **Tools Tab**: See all available tools, their descriptions, and input schemas
   - **Test Tools**: Click on any tool to test it with sample parameters
   - **View Responses**: See formatted JSON responses from API calls
   - **Debug**: Check for errors and validation issues

**Note:** Make sure Node.js 22.7.5+ is installed for MCP Inspector (check with `node --version`).

### Option 2: Testing with a Simple Client Script

Create a test script to verify the server works:

```bash
# Create test-client.js
cat > test-client.js << 'EOF'
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

async function test() {
  const transport = new StdioClientTransport({
    command: 'node',
    args: ['dist/index.js'],
    env: { LITEAPI_API_KEY: process.env.LITEAPI_API_KEY }
  });

  const client = new Client({
    name: 'test-client',
    version: '1.0.0'
  }, {
    capabilities: {}
  });

  await client.connect(transport);

  // List all available tools
  const tools = await client.listTools();
  console.log(`Found ${tools.tools.length} tools:`);
  tools.tools.forEach(tool => {
    console.log(`  - ${tool.name}: ${tool.description}`);
  });

  await client.close();
}

test().catch(console.error);
EOF

# Run the test
export LITEAPI_API_KEY=your_api_key_here
node test-client.js
```

### Option 3: Connecting to Claude Desktop

1. **Get the absolute path to your project:**

```bash
# macOS/Linux
pwd
# Output: /Users/nicholas/Documents/nuitee/liteapi/mcp-server

# Windows (PowerShell)
(Get-Location).Path
```

2. **Open Claude Desktop configuration file:**
   - **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
   - **Linux**: `~/.config/Claude/claude_desktop_config.json`

   If the file doesn't exist, create it with an empty JSON object: `{}`

3. **Add the server configuration:**

```json
{
  "mcpServers": {
    "liteapi": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-server/run-mcp-server.mjs"],
      "env": {
        "LITEAPI_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

**Important**:
- Use `run-mcp-server.mjs` instead of `dist/index.js` to ensure ES modules work correctly
- Replace `/absolute/path/to/mcp-server` with the actual absolute path to this project
- Replace `your_api_key_here` with your actual LiteAPI API key
- On Windows, use forward slashes `/` or escaped backslashes `\\` in the path

**Example for macOS:**
```json
{
  "mcpServers": {
    "liteapi": {
      "command": "node",
      "args": ["/Users/nicholas/Documents/nuitee/liteapi/mcp-server/run-mcp-server.mjs"],
      "env": {
        "LITEAPI_API_KEY": "sand_c0155ab8-c683-4f26-8f94-b5e92c5797b9"
      }
    }
  }
}
```

**Note:** The `.mjs` wrapper script ensures Node.js correctly recognizes ES modules when running from Claude Desktop. If you prefer to use `dist/index.js` directly, make sure Claude Desktop runs it from the project root directory.

4. **Restart Claude Desktop** completely (quit and reopen)

5. **Verify connection:**
   - Open Claude Desktop
   - Start a new conversation
   - Look for MCP tools indicator (usually shows available tools)
   - Try asking: "What LiteAPI tools are available?" or "Search for hotels in Paris"

### Troubleshooting Connection Issues

**If Claude Desktop doesn't recognize the server:**

1. **Check the path is correct:**
   ```bash
   # Test that the file exists and is executable
   ls -la /absolute/path/to/mcp-server/dist/index.js
   node /absolute/path/to/mcp-server/dist/index.js
   ```

2. **Check Claude Desktop logs:**
   - macOS: `~/Library/Logs/Claude/claude_desktop.log`
   - Windows: `%APPDATA%\Claude\logs\`
   - Look for errors related to MCP server startup

3. **Verify JSON syntax:**
   ```bash
   # Validate JSON syntax
   cat ~/Library/Application\ Support/Claude/claude_desktop_config.json | python3 -m json.tool
   ```

4. **Test server manually:**
   ```bash
   export LITEAPI_API_KEY=your_api_key_here
   node dist/index.js
   # Should output: "Loaded X endpoints from Y OpenAPI specs"
   # Should output: "LiteAPI MCP Server running on stdio"
   ```

5. **Check Node.js version:**
   ```bash
   node --version
   # Should be 18.0.0 or higher
   ```

### Available Tools

The server automatically generates tools from all OpenAPI specs in the `openapi-schemas/` directory. Each endpoint becomes a callable MCP tool with:

- **Operation ID** as the tool name
- **Description** from the OpenAPI spec
- **Parameters** automatically extracted and validated

Example tools include:
- `post_hotels_rates` - Search for hotel rates
- `get_prebooks_{prebookId}` - Retrieve prebook details
- `post_bookings` - Create a booking
- And many more...

## Project Structure

```
.
├── src/
│   ├── index.ts              # Entry point
│   ├── server.ts              # Main MCP server implementation
│   └── utils/
│       ├── openapi-parser.ts  # OpenAPI spec parsing
│       ├── schema-converter.ts # OpenAPI to Zod conversion
│       └── api-client.ts      # HTTP client for API calls
├── openapi-schemas/           # OpenAPI specification files
├── dist/                      # Compiled JavaScript (generated)
├── package.json
├── tsconfig.json
└── README.md
```

## Development

### Building

```bash
npm run build
```

### Watching for Changes

```bash
npm run watch
```

### Adding New OpenAPI Specs

1. Add your OpenAPI spec JSON file to `openapi-schemas/`
2. Update the `specFiles` array in `src/utils/openapi-parser.ts` if needed
3. Rebuild and restart the server

## Environment Variables

- `LITEAPI_API_KEY` (stdio only): API key for live calls. Omit it to run discovery, wiring, and docs tools.

## API Modules

The server supports the following LiteAPI modules:

- **Search** (`search.json`) - Hotel search and rate retrieval
- **Booking** (`booking.json`) - Booking management and prebook operations
- **Vouchers** (`voucher.json`) - Voucher creation and management
- **Analytics** (`analytics.json`) - Analytics and reporting
- **Static** (`static.json`) - Static data endpoints
- **Loyalty** (`loyalty.json`) - Loyalty program operations
- **Supply Customization** (`supplyCustomization.json`) - Supply customization

## Error Handling

The server includes comprehensive error handling:
- Missing API keys are caught at startup
- Invalid tool calls return descriptive error messages
- API request failures are properly formatted and returned

## License

MIT

## Support

For issues related to:
- **MCP Server**: Open an issue in this repository
- **LiteAPI**: Contact LiteAPI support
