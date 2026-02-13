import type { VercelRequest, VercelResponse } from '@vercel/node';
import { LiteAPIMCPServer } from '../src/server.js';
import { makeAPIRequest } from '../src/utils/api-client.js';
import { loadOpenAPISpecs, parseEndpoints } from '../src/utils/openapi-parser.js';

// Cache the server instance and endpoints
let serverInstance: LiteAPIMCPServer | null = null;
let endpointsCache: Map<string, any> | null = null;

function getServerInstance(): LiteAPIMCPServer {
  if (!serverInstance) {
    serverInstance = new LiteAPIMCPServer();
  }
  return serverInstance;
}

function getEndpoints(): Map<string, any> {
  if (!endpointsCache) {
    // In Vercel, use process.cwd() which should point to the project root
    const projectRoot = process.cwd();
    const specsDir = `${projectRoot}/openapi-schemas`;
    const specs = loadOpenAPISpecs(specsDir);
    endpointsCache = new Map();

    for (const [specName, spec] of specs.entries()) {
      const endpoints = parseEndpoints(spec);
      for (const endpoint of endpoints) {
        let finalToolName = endpoint.operationId;
        let counter = 1;
        while (endpointsCache.has(finalToolName)) {
          finalToolName = `${endpoint.operationId}_${counter}`;
          counter++;
        }
        endpointsCache.set(finalToolName, { ...endpoint, operationId: finalToolName });
      }
    }
  }
  return endpointsCache;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key, X-Api-Key');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Extract API key from request (header, query param, or Bearer token) or use env var
    const apiKey =
      (req.query.apiKey as string) ||
      (req.headers['x-api-key'] as string) ||
      (req.headers['X-API-Key'] as string) ||
      (req.headers['authorization'] as string)?.replace(/^Bearer\s+/i, '') ||
      process.env.LITEAPI_API_KEY;

    if (!apiKey) {
      return res.status(401).json({
        error: 'API key required',
        message: 'Please provide your LiteAPI API key via one of these methods:\n' +
          '1. Header: X-API-Key: your_api_key\n' +
          '2. Header: Authorization: Bearer your_api_key\n' +
          '3. Query parameter: ?apiKey=your_api_key\n' +
          '4. Or set LITEAPI_API_KEY environment variable on the server'
      });
    }

    // List all available endpoints
    if (req.method === 'GET' && (req.url === '/api' || req.url === '/api/' || !req.url || req.url === '/')) {
      const endpoints = getEndpoints();
      const tools = Array.from(endpoints.values()).map((endpoint) => ({
        name: endpoint.operationId,
        description: endpoint.description || endpoint.summary,
        method: endpoint.method,
        path: endpoint.path,
        parameters: endpoint.parameters,
      }));

      return res.status(200).json({
        tools,
        count: tools.length,
      });
    }

    // Execute a specific tool
    if (req.method === 'POST') {
      const { tool, ...args } = req.body;

      if (!tool) {
        return res.status(400).json({
          error: 'Missing "tool" parameter in request body',
        });
      }

      const endpoints = getEndpoints();
      const endpoint = endpoints.get(tool);

      if (!endpoint) {
        return res.status(404).json({
          error: `Tool "${tool}" not found`,
          availableTools: Array.from(endpoints.keys()),
        });
      }

      // Separate path params, query params, and body
      const pathParams: Record<string, any> = {};
      const queryParams: Record<string, any> = {};
      let body: any = undefined;

      // Extract path parameters
      const pathParamNames = endpoint.parameters
        .filter((p: any) => p.in === 'path')
        .map((p: any) => p.name);

      // Extract query parameters
      const queryParamNames = endpoint.parameters
        .filter((p: any) => p.in === 'query')
        .map((p: any) => p.name);

      // Separate parameters
      for (const [key, value] of Object.entries(args || {})) {
        if (pathParamNames.includes(key)) {
          pathParams[key] = value;
        } else if (queryParamNames.includes(key)) {
          queryParams[key] = value;
        } else if (!pathParamNames.includes(key) && !queryParamNames.includes(key)) {
          if (body === undefined) {
            body = {};
          }
          body[key] = value;
        }
      }

      // If there's a requestBody schema, use the entire args as body (minus path/query params)
      if (endpoint.requestBody) {
        if (Object.keys(pathParams).length === 0 && Object.keys(queryParams).length === 0) {
          body = args;
        } else {
          const bodyKeys = Object.keys(args || {}).filter(
            (k) => !pathParamNames.includes(k) && !queryParamNames.includes(k)
          );
          if (bodyKeys.length > 0) {
            body = {};
            for (const key of bodyKeys) {
              body[key] = args[key];
            }
          } else if (Object.keys(args || {}).length === 0) {
            // If no args provided but requestBody exists, use empty body
            body = {};
          }
        }
      }

      // Make the API request
      const result = await makeAPIRequest(
        endpoint.baseUrl,
        endpoint.method,
        endpoint.path,
        apiKey,
        { ...pathParams, ...queryParams },
        body
      );

      return res.status(200).json({
        success: true,
        tool,
        result,
      });
    }

    return res.status(405).json({
      error: 'Method not allowed',
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return res.status(500).json({
      error: errorMessage,
    });
  }
}
