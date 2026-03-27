# LiteAPI MCP Server

MCP server for LiteAPI using Next.js and mcp-handler (Streamable HTTP). Deploys to Vercel.

## Quick Start

```bash
npm install
npm run dev
```

MCP endpoint: `http://localhost:3000/api/mcp`

## NPM scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Next.js dev server (MCP over HTTP at `/api/mcp`) |
| `npm run build` | Production Next.js build |
| `npm start` | Run production Next.js (`next start`) after `npm run build` |
| `npm run build:stdio` | Compile stdio MCP to `dist/` (`tsc -p tsconfig.stdio.json`) |
| `npm run dev:stdio` | Run stdio MCP with `tsx` (no `dist/` required) |
| `npm test` | Integration smoke test: MCP client lists tools via `dist/index.js` |
| `npm run test:unit` | Vitest unit tests (no API key, mocked HTTP) |
| `npm run test:unit:watch` | Vitest watch mode |
| `npm run inspect` | MCP Inspector against `run-mcp-server.mjs` (needs `build:stdio` first) |

**Two transports:** (1) **HTTP** — `next dev` / Vercel, tools in `lib/mcp-tools.ts`. (2) **stdio** — Claude Desktop / Cursor local MCP, entry `src/index.ts` → `dist/` after `build:stdio`.

---

## Cursor (project MCP)

This repo can include a project `.cursor/mcp.json` that runs the LiteAPI MCP via stdio. Copy `.env.example` to `.env.local` and set `LITEAPI_API_KEY` (that file is gitignored). Restart Cursor after changing env or MCP config.

---

## ChatGPT Setup

Add to ChatGPT MCP Server URL:
```
https://mcp.liteapi.travel/api/mcp?apiKey=YOUR_LITEAPI_KEY
```

Or set `LITEAPI_API_KEY` in Vercel environment variables for single-tenant deployment.

---


## Features

- 🔄 **Dynamic Tool Generation**: Automatically generates MCP tools from OpenAPI specs
- 📚 **Multiple API Modules**: Supports Search, Booking, Vouchers, Analytics, Static, Loyalty, and Supply Customization APIs
- 🔐 **API Key Authentication**: Secure API key management via environment variables
- 🎯 **Type-Safe**: Uses Zod for schema validation and type safety
- 🚀 **Easy Integration**: Works with Claude Desktop and other MCP-compatible clients

## Prerequisites

- Node.js 18+
- npm or yarn
- LiteAPI API Key

## Installation

1. Clone the repository and install dependencies:

```bash
npm install
```

2. Build the app you need:

   - **HTTP MCP (Next.js):** `npm run build`
   - **stdio MCP (`dist/` for Claude / Inspector):** `npm run build:stdio`

3. Set your LiteAPI API key as an environment variable:

```bash
export LITEAPI_API_KEY=your_api_key_here
```

## Usage

### Running the HTTP MCP (Next.js)

Development with hot reload:

```bash
npm run dev
```

Production (after `npm run build`):

```bash
npm start
```

### Running the stdio MCP (Claude Desktop, Cursor, Inspector)

Development without building `dist/`:

```bash
export LITEAPI_API_KEY=your_api_key_here
npm run dev:stdio
```

Production-style (requires `dist/`):

```bash
npm run build:stdio
export LITEAPI_API_KEY=your_api_key_here
node dist/index.js
# or: node run-mcp-server.mjs
```

**Note:** `npm start` runs **`next start`**, not the stdio server. Use `dev:stdio` or `dist/index.js` for stdio.

## Testing

### Unit tests (no API key required)

```bash
npm run test:unit
```

Uses Vitest; mocks HTTP and does not call LiteAPI.

### Integration smoke test (stdio)

Requires `LITEAPI_API_KEY` and a built stdio bundle (`npm run build:stdio`):

```bash
export LITEAPI_API_KEY=your_api_key_here
npm test
```

This connects an MCP client to `dist/index.js` and lists all available tools.

### Option 1: Using MCP Inspector (Recommended for Development)

MCP Inspector is a browser-based tool for testing and debugging MCP servers. It's perfect for inspecting tools, testing calls, and debugging without needing Claude Desktop.

1. **Install and run MCP Inspector:**

```bash
# Make sure your API key is set
export LITEAPI_API_KEY=your_api_key_here

# Run the inspector (it will automatically start your server)
npm run inspect
# Or directly (after: npm run build:stdio):
npx @modelcontextprotocol/inspector node run-mcp-server.mjs
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
├── app/                       # Next.js App Router (HTTP MCP route)
├── lib/
│   └── mcp-tools.ts           # HTTP MCP tool registration (shared OpenAPI→Zod)
├── src/
│   ├── index.ts               # stdio entry point
│   ├── server.ts              # stdio MCP server
│   └── utils/
│       ├── openapi-parser.ts  # OpenAPI spec parsing
│       ├── schema-converter.ts # OpenAPI to Zod (anyOf/oneOf/allOf)
│       └── api-client.ts      # HTTP client for API calls
├── openapi-schemas/           # OpenAPI specification files
├── test/                      # Vitest unit tests
├── dist/                      # stdio build output (generated; gitignored)
├── vitest.config.ts
├── tsconfig.json              # Next.js / editor
├── tsconfig.stdio.json        # stdio compile to dist/
├── package.json
└── README.md
```

## Development

### Building

```bash
npm run build
```

Stdio bundle:

```bash
npm run build:stdio
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

- `LITEAPI_API_KEY` (required): Your LiteAPI API key for authentication

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
