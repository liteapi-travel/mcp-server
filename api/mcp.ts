import type { VercelRequest, VercelResponse } from '@vercel/node';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { loadOpenAPISpecs, parseEndpoints } from '../src/utils/openapi-parser.js';
import { makeAPIRequest } from '../src/utils/api-client.js';
import { z } from 'zod';

// Helper function to create Zod schema from OpenAPI schema
function openAPIToZod(schema: any): z.ZodTypeAny {
  if (!schema || typeof schema !== 'object') {
    return z.string();
  }

  if (schema.enum && schema.enum.length > 0) {
    return z.enum(schema.enum as [string, ...string[]]);
  }

  switch (schema.type) {
    case 'string':
      if (schema.format === 'date') {
        return z.string().describe(schema.description || 'Date in YYYY-MM-DD format');
      }
      if (schema.format === 'date-time') {
        return z.string().datetime().describe(schema.description || 'ISO 8601 datetime');
      }
      return z.string().describe(schema.description || '');
    case 'number':
    case 'integer':
      return schema.type === 'integer'
        ? z.number().int().describe(schema.description || '')
        : z.number().describe(schema.description || '');
    case 'boolean':
      return z.boolean().describe(schema.description || '');
    case 'array':
      if (schema.items) {
        return z.array(openAPIToZod(schema.items)).describe(schema.description || '');
      }
      return z.array(z.any()).describe(schema.description || '');
    case 'object':
      if (schema.properties) {
        const shape: Record<string, z.ZodTypeAny> = {};
        for (const [key, propSchema] of Object.entries(schema.properties)) {
          const zodSchema = openAPIToZod(propSchema as any);
          const isRequired = schema.required?.includes(key);
          shape[key] = isRequired ? zodSchema : zodSchema.optional();
        }
        return z.object(shape).describe(schema.description || '');
      }
      return z.record(z.any()).describe(schema.description || '');
    default:
      return z.any().describe(schema.description || '');
  }
}

function createZodShape(endpoint: any): Record<string, z.ZodTypeAny> {
  const shape: Record<string, z.ZodTypeAny> = {};

  // Add path parameters
  for (const param of endpoint.parameters.filter((p: any) => p.in === 'path')) {
    const zodSchema = param.schema ? openAPIToZod(param.schema) : z.string();
    shape[param.name] = zodSchema.describe(param.description || '');
  }

  // Add query parameters
  for (const param of endpoint.parameters.filter((p: any) => p.in === 'query')) {
    const zodSchema = param.schema ? openAPIToZod(param.schema) : z.string();
    shape[param.name] = param.required
      ? zodSchema.describe(param.description || '')
      : zodSchema.optional().describe(param.description || '');
  }

  // Add request body properties if present
  if (endpoint.requestBody && endpoint.requestBody.properties) {
    for (const [key, propSchema] of Object.entries(endpoint.requestBody.properties)) {
      const zodSchema = openAPIToZod(propSchema);
      const isRequired = endpoint.requestBody.required?.includes(key);
      shape[key] = isRequired
        ? zodSchema.describe((propSchema as any).description || '')
        : zodSchema.optional().describe((propSchema as any).description || '');
    }
  }

  return shape;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle OPTIONS for CORS
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Api-Key');
    return res.status(200).end();
  }

  // Only handle GET requests for SSE connection
  if (req.method !== 'GET') {
    return res.status(405).json({
      error: 'Method not allowed',
      message: 'MCP endpoint only supports GET requests for SSE connection'
    });
  }

  try {
    // Extract API key from query parameter or header
    const apiKey = 
      (req.query.apiKey as string) || 
      (req.headers['x-api-key'] as string) || 
      (req.headers['authorization'] as string)?.replace('Bearer ', '');

    if (!apiKey) {
      return res.status(401).json({
        error: 'API key required',
        message: 'Please provide your LiteAPI API key as a query parameter (?apiKey=YOUR_KEY) or in the X-Api-Key header'
      });
    }

    // Set up SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Api-Key');

    // Create MCP server
    const server = new McpServer({
      name: 'liteapi-mcp-server',
      version: '1.0.0',
    }, {
      capabilities: {
        tools: {},
      },
    });

    // Load OpenAPI specs and register tools
    const projectRoot = process.cwd();
    const specsDir = `${projectRoot}/openapi-schemas`;
    const specs = loadOpenAPISpecs(specsDir);
    const endpoints = new Map<string, any>();

    for (const [specName, spec] of specs.entries()) {
      const parsedEndpoints = parseEndpoints(spec);
      for (const endpoint of parsedEndpoints) {
        let finalToolName = endpoint.operationId;
        let counter = 1;
        while (endpoints.has(finalToolName)) {
          finalToolName = `${endpoint.operationId}_${counter}`;
          counter++;
        }
        endpoints.set(finalToolName, { ...endpoint, operationId: finalToolName });
      }
    }

    // Register all tools
    for (const endpoint of endpoints.values()) {
      const inputSchema = createZodShape(endpoint);
      
      server.registerTool<any, any>(
        endpoint.operationId,
        {
          description: endpoint.description || endpoint.summary,
          inputSchema: inputSchema as any,
        },
        async (args: any) => {
          try {
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
            if (endpoint.requestBody && Object.keys(pathParams).length === 0 && Object.keys(queryParams).length === 0) {
              body = args;
            } else if (endpoint.requestBody) {
              const bodyKeys = Object.keys(args || {}).filter(
                (k) => !pathParamNames.includes(k) && !queryParamNames.includes(k)
              );
              if (bodyKeys.length > 0) {
                body = {};
                for (const key of bodyKeys) {
                  body[key] = args[key];
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

            return {
              content: [
                {
                  type: 'text' as const,
                  text: JSON.stringify(result, null, 2),
                },
              ],
            };
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            return {
              content: [
                {
                  type: 'text' as const,
                  text: `Error calling ${endpoint.operationId}: ${errorMessage}`,
                },
              ],
              isError: true,
            };
          }
        }
      );
    }

    // Create SSE transport and connect
    const transport = new SSEServerTransport('/mcp', res);
    await server.connect(transport);
    await transport.start();
  } catch (error) {
    console.error('Error establishing MCP SSE connection:', error);
    if (!res.headersSent) {
      return res.status(500).json({
        error: 'Failed to establish MCP connection',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}
