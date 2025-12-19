import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { registerToolsFromOpenApi } from "./toolgen";
import { z } from "zod";
import express from "express";
import { createServer } from "http";
import { randomUUID } from "crypto";
import { join } from "path";

// Session management: Map of session ID to API key
const sessionApiKeys = new Map<string, string>();

// Helper to get API key for a session
function getApiKeyForSession(sessionId: string | undefined): string | null {
  if (!sessionId) return null;
  return sessionApiKeys.get(sessionId) || null;
}

// Create API key getter function for tools
function createApiKeyGetter(sessionId: string | undefined) {
  return () => {
    const apiKey = getApiKeyForSession(sessionId);
    if (!apiKey) {
      throw new Error('API key not found. Please provide your LiteAPI key when connecting.');
    }
    return apiKey;
  };
}

const server = new McpServer({
  name: "LiteAPI MCP Server",
  version: "3.0.0",
});

// Resolve OpenAPI schema paths - works in both local and Vercel environments
function loadSchema(filename: string): any {
  // In Vercel, process.cwd() points to the project root
  // Try multiple possible paths
  const cwd = process.cwd();
  const possiblePaths = [
    join(cwd, 'openapi-schemas', filename),
    // Try relative to dist folder if running from compiled code
    join(cwd, '..', 'openapi-schemas', filename),
    // Try from api folder perspective (Vercel)
    join(cwd, '..', '..', 'openapi-schemas', filename),
  ];

  for (const schemaPath of possiblePaths) {
    try {
      const schema = require(schemaPath);
      if (process.env.VERCEL || process.env.NODE_ENV === 'development') {
        console.log(`✓ Loaded schema: ${filename} from ${schemaPath}`);
      }
      return schema;
    } catch (e: any) {
      // Continue to next path
      if (e.code !== 'MODULE_NOT_FOUND' && process.env.NODE_ENV === 'development') {
        console.warn(`  Failed ${schemaPath}:`, e.message);
      }
    }
  }

  // If all paths failed, throw with helpful error
  console.error(`✗ Failed to load schema: ${filename}`);
  console.error(`  Checked paths:`, possiblePaths);
  console.error(`  Current working directory:`, cwd);
  throw new Error(`Could not load OpenAPI schema: ${filename}. Ensure openapi-schemas directory exists at project root.`);
}

const analytics = loadSchema('analytics.json');
const booking = loadSchema('booking.json');
const loyalty = loadSchema('loyalty.json');
const search = loadSchema('search.json');
const supplyCustomization = loadSchema('supplyCustomization.json');
const voucher = loadSchema('voucher.json');
const staticData = loadSchema('static.json');

// For stdio mode, use environment variable or default
const defaultApiKeyGetter = () => process.env.LITEAPI_API_KEY || 'sand_c0155ab8-c683-4f26-8f94-b5e92c5797b9';

registerToolsFromOpenApi(server, analytics, defaultApiKeyGetter);
registerToolsFromOpenApi(server, booking, defaultApiKeyGetter);
registerToolsFromOpenApi(server, loyalty, defaultApiKeyGetter);
registerToolsFromOpenApi(server, search, defaultApiKeyGetter);
registerToolsFromOpenApi(server, supplyCustomization, defaultApiKeyGetter);
registerToolsFromOpenApi(server, staticData, defaultApiKeyGetter);
registerToolsFromOpenApi(server, voucher, defaultApiKeyGetter);

// Register custom booking completion tool
server.tool(
  "complete-booking",
  "Complete a hotel booking by opening the booking URL with the provided parameters",
  {
    hotelId: z.string().describe("The hotel ID (e.g., 'lp39590')"),
    checkin: z.string().describe("Check-in date in YYYY-MM-DD format (e.g., '2025-12-29')"),
    checkout: z.string().describe("Check-out date in YYYY-MM-DD format (e.g., '2025-12-30')"),
    rooms: z.number().describe("Number of rooms (e.g., 1)"),
    adults: z.number().describe("Number of adults (e.g., 2)"),
    children: z.number().describe("Number of children (e.g., 0)"),
    name: z.string().describe("Hotel or location name (e.g., 'London')")
  },
  async (args) => {
    const { hotelId, checkin, checkout, rooms, adults, children, name } = args;

    const bookingUrl = `https://whitelabel.nuitee.link/hotels/${hotelId}?checkin=${checkin}&checkout=${checkout}&rooms=${rooms}&adults=${adults}&children=${children}&name=${encodeURIComponent(name)}`;

    return {
      content: [{
        type: "text",
        text: `Booking URL generated: ${bookingUrl}\n\nTo complete the booking, please open this URL in your browser.`
      }]
    };
  }
);

// Function to create and configure the Express app
export function createApp() {
  const app = express();

  // Middleware
  app.use(express.json());
  app.use(express.static('public'));

  // Error handling middleware
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Express error:', err);
    res.status(500).json({
      error: 'Internal server error',
      message: err.message,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
  });

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
  });

  // MCP SSE endpoint with authentication
  app.get('/mcp', async (req, res) => {
    try {
      // Extract API key from query parameter or header
      const apiKey = req.query.apiKey as string || req.headers['x-api-key'] as string || req.headers['authorization']?.replace('Bearer ', '');

      if (!apiKey) {
        res.status(401).json({
          error: 'API key required',
          message: 'Please provide your LiteAPI API key as a query parameter (?apiKey=YOUR_KEY) or in the X-Api-Key header'
        });
        return;
      }

      // Generate session ID
      const sessionId = randomUUID();
      sessionApiKeys.set(sessionId, apiKey);

      // Clean up session after 24 hours
      setTimeout(() => {
        sessionApiKeys.delete(sessionId);
      }, 24 * 60 * 60 * 1000);

      // Create a new server instance for this session with the API key getter
      const sessionServer = new McpServer({
        name: "LiteAPI MCP Server",
        version: "3.0.0",
      });

      const apiKeyGetter = createApiKeyGetter(sessionId);

      // Register all tools with the session-specific API key getter
      registerToolsFromOpenApi(sessionServer, analytics, apiKeyGetter);
      registerToolsFromOpenApi(sessionServer, booking, apiKeyGetter);
      registerToolsFromOpenApi(sessionServer, loyalty, apiKeyGetter);
      registerToolsFromOpenApi(sessionServer, search, apiKeyGetter);
      registerToolsFromOpenApi(sessionServer, supplyCustomization, apiKeyGetter);
      registerToolsFromOpenApi(sessionServer, staticData, apiKeyGetter);
      registerToolsFromOpenApi(sessionServer, voucher, apiKeyGetter);

      // Register custom booking completion tool
      sessionServer.tool(
        "complete-booking",
        "Complete a hotel booking by opening the booking URL with the provided parameters",
        {
          hotelId: z.string().describe("The hotel ID (e.g., 'lp39590')"),
          checkin: z.string().describe("Check-in date in YYYY-MM-DD format (e.g., '2025-12-29')"),
          checkout: z.string().describe("Check-out date in YYYY-MM-DD format (e.g., '2025-12-30')"),
          rooms: z.number().describe("Number of rooms (e.g., 1)"),
          adults: z.number().describe("Number of adults (e.g., 2)"),
          children: z.number().describe("Number of children (e.g., 0)"),
          name: z.string().describe("Hotel or location name (e.g., 'London')")
        },
        async (args) => {
          const { hotelId, checkin, checkout, rooms, adults, children, name } = args;

          const bookingUrl = `https://whitelabel.nuitee.link/hotels/${hotelId}?checkin=${checkin}&checkout=${checkout}&rooms=${rooms}&adults=${adults}&children=${children}&name=${encodeURIComponent(name)}`;

          return {
            content: [{
              type: "text",
              text: `Booking URL generated: ${bookingUrl}\n\nTo complete the booking, please open this URL in your browser.`
            }]
          };
        }
      );

      const transport = new SSEServerTransport('/mcp', res);
      await sessionServer.connect(transport);
      await transport.start();
    } catch (error) {
      console.error('Error establishing SSE connection:', error);
      res.status(500).json({ error: 'Failed to establish MCP connection' });
    }
  });

  // Handle POST messages to MCP endpoint
  app.post('/mcp', async (req, res) => {
    try {
      // Extract API key from query parameter or header
      const apiKey = req.query.apiKey as string || req.headers['x-api-key'] as string || req.headers['authorization']?.replace('Bearer ', '');

      if (!apiKey) {
        res.status(401).json({
          error: 'API key required',
          message: 'Please provide your LiteAPI API key as a query parameter (?apiKey=YOUR_KEY) or in the X-Api-Key header'
        });
        return;
      }

      // For POST requests, we need to handle them differently
      // Since MCP over SSE uses GET for the connection, POST might be for other purposes
      // For now, we'll return an error suggesting to use GET for SSE connection
      res.status(405).json({
        error: 'Method not allowed',
        message: 'Use GET /mcp?apiKey=YOUR_KEY to establish an SSE connection'
      });
    } catch (error) {
      console.error('Error handling MCP message:', error);
      res.status(500).json({ error: 'Failed to process MCP message' });
    }
  });

  return app;
}

// Check if we should run in stdio mode (for local development) or HTTP mode (for remote)
const isStdioMode = process.argv.includes('--stdio') || process.env.MCP_MODE === 'stdio';

if (isStdioMode) {
  // Local development mode - use stdio transport
  const transport = new StdioServerTransport();
  server.connect(transport);
} else {
  // Remote mode - use HTTP server with SSE transport
  const app = createApp();
  const httpServer = createServer(app);

  // Export app for Vercel serverless functions
  // Vercel will use this export when deployed
  if (process.env.VERCEL || process.env.VERCEL_ENV) {
    // For Vercel, export the app directly
    // @ts-ignore - Vercel expects CommonJS export
    module.exports = app;
  } else {
    // Regular Node.js server mode
    const port = process.env.PORT || 3000;
    httpServer.listen(port, () => {
      console.log(`🚀 LiteAPI MCP Server running on port ${port}`);
      console.log(`📡 MCP endpoint: http://localhost:${port}/mcp`);
      console.log(`❤️  Health check: http://localhost:${port}/health`);
    });
  }
}
