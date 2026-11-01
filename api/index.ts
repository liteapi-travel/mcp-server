import type { VercelRequest, VercelResponse } from '@vercel/node';
import { LiteAPIMCPServer } from '../src/server.js';
import { makeAPIRequest } from '../src/utils/api-client.js';
import { loadEndpointMap, wiringForEndpoint } from '../src/utils/catalog.js';
import { SANDBOX_SAMPLE_API_KEY } from '../src/utils/sandbox-key.js';

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
    endpointsCache = loadEndpointMap();
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
    // Header, then ?apiKey=, then Bearer. None of those → shared sandbox key.
    const headerKey = req.headers['x-api-key'];
    const fromHeader = (Array.isArray(headerKey) ? headerKey[0] : headerKey)?.trim();
    const fromQuery = (req.query.apiKey as string | undefined)?.trim();
    const authorization = req.headers['authorization'];
    const authValue = Array.isArray(authorization) ? authorization[0] : authorization;
    const fromBearer = authValue?.replace(/^Bearer\s+/i, '').trim();
    const callerKey = fromHeader || fromQuery || fromBearer;
    const apiKey = callerKey || SANDBOX_SAMPLE_API_KEY;

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
        mode: callerKey ? 'live' : 'sandbox-sample',
        tools,
        count: tools.length,
        discoveryTools: ['list_endpoints', 'describe_endpoint', 'search_docs', 'fetch_docs_page'],
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

      if (!apiKey) {
        return res.status(200).json({
          success: true,
          tool,
          result: wiringForEndpoint(endpoint),
        });
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
