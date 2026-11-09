import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
import { loadOpenAPISpecs, parseEndpoints, ParsedEndpoint } from './utils/openapi-parser.js';
import { makeAPIRequest } from './utils/api-client.js';
import { wiringForEndpoint } from './utils/catalog.js';
import { registerDiscoveryTools } from './utils/discovery-tools.js';
import { SANDBOX_SAMPLE_API_KEY } from './utils/sandbox-key.js';
import { createToolInputShape } from './utils/schema-converter.js';

const API_KEY_ENV = 'LITEAPI_API_KEY';

const READ_ONLY_POST_OPS = new Set([
  'post_hotels_rates',
  'post_hotels_min_rates',
  'post_analytics_weekly',
  'post_analytics_report',
  'post_analytics_markets',
  'post_analytics_hotels',
  'post_commissions_report',
  'search_bookings',
  'post_flights_rates',
  'post_flights_verify',
]);

const DESTRUCTIVE_PUT_OPS = new Set([
  'put_bookings_bookingid',
]);

function getToolAnnotations(method: string, operationId: string): ToolAnnotations {
  const isGet = method === 'GET';
  const isDelete = method === 'DELETE';
  const readOnly = isGet || READ_ONLY_POST_OPS.has(operationId);
  const destructive = isDelete || DESTRUCTIVE_PUT_OPS.has(operationId);

  return {
    readOnlyHint: readOnly,
    destructiveHint: destructive,
    idempotentHint: isGet || method === 'PUT',
    openWorldHint: true,
  };
}

export class LiteAPIMCPServer {
  private server: McpServer;
  private apiKey?: string;
  private endpoints: Map<string, ParsedEndpoint> = new Map();

  constructor() {
    // Env key wins. Otherwise sample calls use the shared sandbox key.
    this.apiKey = process.env[API_KEY_ENV] || SANDBOX_SAMPLE_API_KEY;

    this.server = new McpServer(
      {
        name: 'liteapi-mcp-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.loadEndpoints();
    this.registerTools();
  }

  private registerTools() {
    for (const endpoint of this.endpoints.values()) {
      const inputSchema = createToolInputShape(endpoint);
      const annotations = getToolAnnotations(endpoint.method, endpoint.operationId);
      
      this.server.tool(
        endpoint.operationId,
        endpoint.description || endpoint.summary,
        inputSchema as any,
        annotations,
        async (args: any) => {
          try {
            // Separate path params, query params, and body
            const pathParams: Record<string, any> = {};
            const queryParams: Record<string, any> = {};
            let body: any = undefined;

            // Extract path parameters
            const pathParamNames = endpoint.parameters
              .filter((p) => p.in === 'path')
              .map((p) => p.name);

            // Extract query parameters
            const queryParamNames = endpoint.parameters
              .filter((p) => p.in === 'query')
              .map((p) => p.name);

            // Separate parameters
            for (const [key, value] of Object.entries(args || {})) {
              if (pathParamNames.includes(key)) {
                pathParams[key] = value;
              } else if (queryParamNames.includes(key)) {
                queryParams[key] = value;
              } else if (!pathParamNames.includes(key) && !queryParamNames.includes(key)) {
                // This might be a body parameter
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
              // Merge remaining args into body
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

            if (!this.apiKey) {
              return {
                content: [
                  {
                    type: 'text' as const,
                    text: JSON.stringify(wiringForEndpoint(endpoint), null, 2),
                  },
                ],
              };
            }

            // Make the API request
            const result = await makeAPIRequest(
              endpoint.baseUrl,
              endpoint.method,
              endpoint.path,
              this.apiKey,
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
    registerDiscoveryTools(this.server, this.endpoints);
  }

  private createJSONSchema(endpoint: ParsedEndpoint): Record<string, any> {
    const properties: Record<string, any> = {};
    const required: string[] = [];

    // Add path parameters
    for (const param of endpoint.parameters.filter((p) => p.in === 'path')) {
      properties[param.name] = this.openAPIToJSONSchema(param.schema || { type: 'string' });
      if (param.required) {
        required.push(param.name);
      }
      if (param.description) {
        properties[param.name].description = param.description;
      }
    }

    // Add query parameters
    for (const param of endpoint.parameters.filter((p) => p.in === 'query')) {
      properties[param.name] = this.openAPIToJSONSchema(param.schema || { type: 'string' });
      if (param.required) {
        required.push(param.name);
      }
      if (param.description) {
        properties[param.name].description = param.description;
      }
    }

    // Add request body properties if present
    if (endpoint.requestBody && endpoint.requestBody.properties) {
      for (const [key, propSchema] of Object.entries(endpoint.requestBody.properties)) {
        properties[key] = this.openAPIToJSONSchema(propSchema);
        const isRequired = endpoint.requestBody.required?.includes(key);
        if (isRequired) {
          required.push(key);
        }
      }
    }

    return {
      type: 'object',
      properties,
      required: required.length > 0 ? required : undefined,
    };
  }

  private openAPIToJSONSchema(schema: any): Record<string, any> {
    if (!schema || typeof schema !== 'object') {
      return { type: 'string' };
    }

    const jsonSchema: Record<string, any> = {
      type: schema.type || 'string',
    };

    if (schema.description) {
      jsonSchema.description = schema.description;
    }

    if (schema.enum) {
      jsonSchema.enum = schema.enum;
    }

    if (schema.format) {
      jsonSchema.format = schema.format;
    }

    if (schema.type === 'array' && schema.items) {
      jsonSchema.items = this.openAPIToJSONSchema(schema.items);
    }

    if (schema.type === 'object' && schema.properties) {
      jsonSchema.properties = {};
      jsonSchema.required = schema.required || [];
      for (const [key, propSchema] of Object.entries(schema.properties)) {
        jsonSchema.properties[key] = this.openAPIToJSONSchema(propSchema);
      }
    }

    return jsonSchema;
  }


  private loadEndpoints() {
    // Resolve path relative to project root
    const projectRoot = process.cwd();
    const specsDir = `${projectRoot}/openapi-schemas`;
    const specs = loadOpenAPISpecs(specsDir);

    for (const [specName, spec] of specs.entries()) {
      const endpoints = parseEndpoints(spec);
      for (const endpoint of endpoints) {
        // The operationId is already sanitized by parseEndpoints
        // Ensure uniqueness by appending a counter if needed
        let finalToolName = endpoint.operationId;
        let counter = 1;
        while (this.endpoints.has(finalToolName)) {
          finalToolName = `${endpoint.operationId}_${counter}`;
          counter++;
        }
        
        this.endpoints.set(finalToolName, { ...endpoint, operationId: finalToolName });
      }
    }

    console.error(`Loaded ${this.endpoints.size} endpoints from ${specs.size} OpenAPI specs`);
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('LiteAPI MCP Server running on stdio');
  }
}
