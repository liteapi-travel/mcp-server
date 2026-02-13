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

// Helper to extract API key from request (supports multiple methods)
function extractApiKey(req: express.Request): string | null {
  // 1. Check Authorization header (Bearer token) - OAuth 2.1 compliant
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  // 2. Check X-Api-Key header (for backward compatibility)
  const apiKeyHeader = req.headers['x-api-key'] as string;
  if (apiKeyHeader) {
    return apiKeyHeader;
  }

  // 3. Check query parameter (for backward compatibility, less secure)
  const queryApiKey = req.query.apiKey as string;
  if (queryApiKey) {
    return queryApiKey;
  }

  return null;
}

// Get canonical server URI for OAuth resource parameter
function getCanonicalServerUri(req: express.Request): string {
  const protocol = req.protocol || 'https';
  const host = req.get('host') || 'localhost:3000';
  const basePath = '/mcp';
  return `${protocol}://${host}${basePath}`;
}

const server = new McpServer({
  name: "LiteAPI MCP Server",
  version: "3.0.0",
});

// Resolve OpenAPI schema paths - works in both local and Vercel environments
function loadSchema(filename: string): any {
  // Get the directory where this file is located
  // Use require.resolve to find the actual file location, then get its directory
  const path = require('path');
  const fs = require('fs');
  
  let projectRoot: string | undefined;
  
  // Method 1: Try __dirname (should work in CommonJS)
  // @ts-ignore - __dirname is available at runtime in CommonJS
  if (typeof __dirname !== 'undefined' && __dirname && __dirname !== '/') {
    projectRoot = path.resolve(__dirname, '..');
  }
  
  // Method 2: Try to resolve this module's location
  if (!projectRoot) {
    try {
      // @ts-ignore - __filename might be available
      if (typeof __filename !== 'undefined' && __filename) {
        projectRoot = path.resolve(path.dirname(__filename), '..');
      }
    } catch (e) {
      // Ignore
    }
  }
  
  // Method 3: Walk up from process.cwd() to find project root
  if (!projectRoot) {
    let dir = process.cwd();
    while (dir !== '/' && dir !== path.dirname(dir)) {
      if (fs.existsSync(path.join(dir, 'package.json')) || fs.existsSync(path.join(dir, 'openapi-schemas'))) {
        projectRoot = dir;
        break;
      }
      dir = path.dirname(dir);
    }
  }
  
  // Method 4: Try to find by looking for node_modules or dist folder
  if (!projectRoot) {
    let dir = process.cwd();
    const maxDepth = 10;
    let depth = 0;
    while (dir !== '/' && dir !== path.dirname(dir) && depth < maxDepth) {
      if (fs.existsSync(path.join(dir, 'dist', 'index.js')) || 
          fs.existsSync(path.join(dir, 'node_modules'))) {
        projectRoot = dir;
        break;
      }
      dir = path.dirname(dir);
      depth++;
    }
  }
  
  // Fallback to process.cwd()
  projectRoot = projectRoot || process.cwd();
  
  // Try multiple possible paths relative to the project root
  const possiblePaths = [
    // Most common: openapi-schemas at project root
    join(projectRoot, 'openapi-schemas', filename),
    // Relative to dist folder (when running compiled code)
    join(projectRoot, 'dist', '..', 'openapi-schemas', filename),
    // Try process.cwd() as fallback
    join(process.cwd(), 'openapi-schemas', filename),
    // Try from api folder perspective (Vercel)
    join(process.cwd(), '..', '..', 'openapi-schemas', filename),
  ];

  for (const schemaPath of possiblePaths) {
    try {
      const schema = require(schemaPath);
      // Don't log to stdout in stdio mode (MCP protocol uses stdout for JSON-RPC)
      // Use console.error for stderr if needed for debugging
      return schema;
    } catch (e: any) {
      // Continue to next path
      // Don't log to stdout in stdio mode (MCP protocol uses stdout for JSON-RPC)
      // Use console.error for stderr if needed for debugging
    }
  }

  // If all paths failed, throw with helpful error
      // Use console.error (stderr) instead of console.log (stdout) to avoid breaking MCP protocol
      console.error(`✗ Failed to load schema: ${filename}`);
      console.error(`  Checked paths:`, possiblePaths);
      console.error(`  Project root: ${projectRoot}`);
      console.error(`  Working directory: ${process.cwd()}`);
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
// @ts-expect-error - Type instantiation depth issue with complex Zod schemas
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

  // Request logging middleware (production-ready)
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      const logLevel = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
    });
    next();
  });

  // Error handling middleware
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('[ERROR]', {
      timestamp: new Date().toISOString(),
      method: req.method,
      path: req.path,
      error: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
    res.status(err.status || 500).json({
      error: 'Internal server error',
      message: err.message,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
  });

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({ 
      status: 'healthy', 
      timestamp: new Date().toISOString(),
      version: '3.0.0',
      uptime: process.uptime()
    });
  });

  // Protected Resource Metadata discovery endpoint (OAuth 2.0 Protected Resource Metadata - RFC9728)
  // This endpoint helps MCP clients discover authorization requirements
  app.get('/.well-known/oauth-protected-resource', (req, res) => {
    const canonicalUri = getCanonicalServerUri(req);
    res.json({
      resource: canonicalUri,
      authorization_servers: [
        // For now, we use API key authentication directly
        // In a full OAuth implementation, this would point to an authorization server
        // This allows clients to understand the authentication mechanism
      ],
      scopes_supported: [
        'liteapi:read',
        'liteapi:write'
      ],
      bearer_methods_supported: ['header'],
      resource_documentation: 'https://liteapi.travel/docs'
    });
  });

  // Alternative well-known path for MCP endpoint-specific metadata
  app.get('/.well-known/oauth-protected-resource/mcp', (req, res) => {
    const canonicalUri = getCanonicalServerUri(req);
    res.json({
      resource: canonicalUri,
      authorization_servers: [],
      scopes_supported: [
        'liteapi:read',
        'liteapi:write'
      ],
      bearer_methods_supported: ['header'],
      resource_documentation: 'https://liteapi.travel/docs'
    });
  });

  // MCP SSE endpoint with authentication
  app.get('/mcp', async (req, res) => {
    try {
      // Extract API key using multiple methods (OAuth Bearer token preferred)
      const apiKey = extractApiKey(req);

      if (!apiKey) {
        // Return 401 with WWW-Authenticate header per OAuth 2.1 spec
        const canonicalUri = getCanonicalServerUri(req);
        const resourceMetadataUrl = `${req.protocol}://${req.get('host')}/.well-known/oauth-protected-resource/mcp`;
        
        res.status(401).set({
          'WWW-Authenticate': `Bearer resource_metadata="${resourceMetadataUrl}", scope="liteapi:read liteapi:write"`
        }).json({
          error: 'unauthorized',
          error_description: 'API key required. Provide your LiteAPI API key via Authorization: Bearer <token> header, X-Api-Key header, or ?apiKey= query parameter.',
          message: 'Please provide your LiteAPI API key as a Bearer token in the Authorization header (recommended), X-Api-Key header, or as a query parameter (?apiKey=YOUR_KEY)'
        });
        return;
      }

      // Generate session ID for this connection
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
    } catch (error: any) {
      console.error('[ERROR] Failed to establish SSE connection:', {
        error: error.message,
        stack: error.stack
      });
      
      if (!res.headersSent) {
        res.status(500).json({ 
          error: 'internal_server_error',
          error_description: 'Failed to establish MCP connection',
          message: error.message
        });
      }
    }
  });

  // Handle POST messages to MCP endpoint (for future use)
  app.post('/mcp', async (req, res) => {
    try {
      const apiKey = extractApiKey(req);

      if (!apiKey) {
        const canonicalUri = getCanonicalServerUri(req);
        const resourceMetadataUrl = `${req.protocol}://${req.get('host')}/.well-known/oauth-protected-resource/mcp`;
        
        res.status(401).set({
          'WWW-Authenticate': `Bearer resource_metadata="${resourceMetadataUrl}", scope="liteapi:read liteapi:write"`
        }).json({
          error: 'unauthorized',
          error_description: 'API key required',
          message: 'Please provide your LiteAPI API key via Authorization: Bearer <token> header, X-Api-Key header, or ?apiKey= query parameter.'
        });
        return;
      }

      // For POST requests, we need to handle them differently
      // Since MCP over SSE uses GET for the connection, POST might be for other purposes
      // For now, we'll return an error suggesting to use GET for SSE connection
      res.status(405).json({
        error: 'method_not_allowed',
        error_description: 'Use GET /mcp to establish an SSE connection',
        message: 'Use GET /mcp?apiKey=YOUR_KEY to establish an SSE connection'
      });
    } catch (error: any) {
      console.error('[ERROR] Failed to process MCP POST request:', {
        error: error.message,
        stack: error.stack
      });
      res.status(500).json({ 
        error: 'internal_server_error',
        error_description: 'Failed to process MCP message',
        message: error.message
      });
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
      // Use console.error (stderr) instead of console.log (stdout) to avoid breaking MCP protocol
      // These messages are only shown in HTTP mode, not stdio mode
      console.error(`🚀 LiteAPI MCP Server running on port ${port}`);
      console.error(`📡 MCP endpoint: http://localhost:${port}/mcp`);
      console.error(`❤️  Health check: http://localhost:${port}/health`);
      console.error(`🔐 Protected Resource Metadata: http://localhost:${port}/.well-known/oauth-protected-resource`);
    });
  }
}
