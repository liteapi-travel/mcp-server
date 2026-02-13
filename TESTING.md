# Testing Guide for LiteAPI MCP Server

This guide provides detailed instructions for testing the MCP server using different methods.

## Quick Start

### Prerequisites
- Node.js 18+ installed
- LiteAPI API key set as environment variable
- Server built (`npm run build`)

### Set Your API Key

```bash
export LITEAPI_API_KEY=your_api_key_here
```

## Method 1: MCP Inspector (Best for Development)

MCP Inspector is the official tool for testing MCP servers. It provides a web UI to explore tools, test calls, and debug issues.

### Installation & Usage

```bash
# Run inspector (no installation needed)
export LITEAPI_API_KEY=your_api_key_here
npx @modelcontextprotocol/inspector node dist/index.js
```

This will:
1. Start a proxy server on port 6277
2. Open a browser at `http://localhost:6274`
3. Display all available tools and allow interactive testing

### Features in Inspector

- **Tools Tab**: Browse all 48+ tools with schemas
- **Test Calls**: Click any tool to test with parameters
- **View Responses**: See formatted JSON responses
- **Error Debugging**: Check validation errors and API failures
- **Real-time Logs**: Monitor server output

### Example Test Flow

1. Open Inspector: `npx @modelcontextprotocol/inspector node dist/index.js`
2. Navigate to "Tools" tab
3. Find a tool like `post_hotels_rates`
4. Click "Test" and fill in parameters:
   ```json
   {
     "checkin": "2026-07-01",
     "checkout": "2026-07-03",
     "currency": "USD",
     "guestNationality": "US",
     "occupancies": [{"adults": 2}],
     "hotelIds": ["lp1897"]
   }
   ```
5. Click "Call Tool" to see the response

## Method 2: Simple Node.js Test Script

Create a test script to programmatically test the server:

```javascript
// test-server.js
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

async function testServer() {
  const transport = new StdioClientTransport({
    command: 'node',
    args: ['dist/index.js'],
    env: { 
      LITEAPI_API_KEY: process.env.LITEAPI_API_KEY 
    }
  });

  const client = new Client({
    name: 'test-client',
    version: '1.0.0'
  }, {
    capabilities: {}
  });

  try {
    await client.connect(transport);
    console.log('✅ Connected to server\n');

    // List all tools
    const tools = await client.listTools();
    console.log(`📋 Found ${tools.tools.length} tools:\n`);
    
    tools.tools.slice(0, 10).forEach(tool => {
      console.log(`  • ${tool.name}`);
      console.log(`    ${tool.description?.substring(0, 80)}...\n`);
    });

    // Test a specific tool
    console.log('\n🧪 Testing post_hotels_rates tool...\n');
    const result = await client.callTool({
      name: 'post_hotels_rates',
      arguments: {
        checkin: '2026-07-01',
        checkout: '2026-07-03',
        currency: 'USD',
        guestNationality: 'US',
        occupancies: [{ adults: 2 }],
        hotelIds: ['lp1897']
      }
    });

    console.log('✅ Tool call successful!');
    console.log('Response:', JSON.stringify(result, null, 2));

    await client.close();
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

testServer();
```

Run it:
```bash
export LITEAPI_API_KEY=your_api_key_here
node test-server.js
```

## Method 3: Claude Desktop Integration

### Setup Steps

1. **Get your project path:**
   ```bash
   pwd
   # Example: /Users/nicholas/Documents/nuitee/liteapi/mcp-server
   ```

2. **Edit Claude Desktop config:**
   ```bash
   # macOS
   code ~/Library/Application\ Support/Claude/claude_desktop_config.json
   
   # Windows (PowerShell)
   code $env:APPDATA\Claude\claude_desktop_config.json
   ```

3. **Add configuration:**
   ```json
   {
     "mcpServers": {
       "liteapi": {
         "command": "node",
         "args": ["/Users/nicholas/Documents/nuitee/liteapi/mcp-server/dist/index.js"],
         "env": {
           "LITEAPI_API_KEY": "your_api_key_here"
         }
       }
     }
   }
   ```

4. **Restart Claude Desktop**

5. **Test in Claude:**
   - Ask: "What LiteAPI tools do you have access to?"
   - Ask: "Search for hotels in Paris for July 1-3, 2026"
   - Ask: "Show me hotel rates for hotel ID lp1897"

### Verifying Connection

If tools aren't showing up:

1. **Check server starts correctly:**
   ```bash
   export LITEAPI_API_KEY=your_api_key_here
   timeout 5 node dist/index.js || echo "Server started (timeout expected)"
   ```

2. **Check Claude Desktop logs:**
   - macOS: `~/Library/Logs/Claude/claude_desktop.log`
   - Look for MCP-related errors

3. **Validate JSON config:**
   ```bash
   python3 -m json.tool ~/Library/Application\ Support/Claude/claude_desktop_config.json
   ```

## Method 4: Manual Testing with echo

Test the server responds to MCP protocol:

```bash
export LITEAPI_API_KEY=your_api_key_here

# Send initialize request
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}' | node dist/index.js
```

## Common Issues & Solutions

### Issue: "Missing required environment variable"
**Solution:** Make sure `LITEAPI_API_KEY` is exported:
```bash
export LITEAPI_API_KEY=your_key
echo $LITEAPI_API_KEY  # Should print your key
```

### Issue: "Cannot find module"
**Solution:** Rebuild the project:
```bash
npm run build
```

### Issue: Inspector shows "Connection failed"
**Solution:** 
1. Check Node.js version: `node --version` (needs 22.7.5+ for Inspector)
2. Verify server starts: `node dist/index.js`
3. Check port 6277 isn't in use

### Issue: Claude Desktop doesn't show tools
**Solution:**
1. Verify absolute path is correct
2. Restart Claude Desktop completely
3. Check logs for errors
4. Ensure JSON config is valid

### Issue: Tool calls return errors
**Solution:**
1. Check API key is valid
2. Verify parameters match the schema
3. Check network connectivity
4. Review API response in Inspector

## Testing Checklist

- [ ] Server builds without errors (`npm run build`)
- [ ] Server starts and loads endpoints (`npm start`)
- [ ] MCP Inspector connects and shows tools
- [ ] Can test at least one tool in Inspector
- [ ] Claude Desktop config is valid JSON
- [ ] Claude Desktop recognizes the server
- [ ] Can call tools from Claude Desktop
- [ ] API responses are formatted correctly

## Next Steps

Once testing is successful:
1. Use Inspector for development and debugging
2. Use Claude Desktop for production integration
3. Monitor logs for any issues
4. Update OpenAPI specs as needed
