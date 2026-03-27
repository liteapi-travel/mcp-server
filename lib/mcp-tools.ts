/**
 * MCP tools registration - shared logic for OpenAPI-based tools
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { loadOpenAPISpecs, parseEndpoints, type OpenAPISchema } from '../src/utils/openapi-parser';
import { makeAPIRequest } from '../src/utils/api-client';
import { openAPIToZod } from '../src/utils/schema-converter';

function createZodShape(endpoint: any): Record<string, z.ZodTypeAny> {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const param of endpoint.parameters.filter((p: any) => p.in === 'path')) {
    shape[param.name] = (param.schema ? openAPIToZod(param.schema as OpenAPISchema) : z.string()).describe(param.description || '');
  }
  for (const param of endpoint.parameters.filter((p: any) => p.in === 'query')) {
    const zodSchema = param.schema ? openAPIToZod(param.schema as OpenAPISchema) : z.string();
    shape[param.name] = param.required ? zodSchema.describe(param.description || '') : zodSchema.optional().describe(param.description || '');
  }
  if (endpoint.requestBody?.properties) {
    for (const [key, propSchema] of Object.entries(endpoint.requestBody.properties)) {
      const zodSchema = openAPIToZod(propSchema as OpenAPISchema);
      shape[key] = endpoint.requestBody.required?.includes(key)
        ? zodSchema.describe((propSchema as any).description || '')
        : zodSchema.optional().describe((propSchema as any).description || '');
    }
  }
  return shape;
}

export type ApiKeyGetter = (extra?: { authInfo?: { extra?: { apiKey?: string } } }) => string;

export function registerLiteApiTools(server: McpServer, apiKeyOrGetter: string | ApiKeyGetter) {
  const getApiKey: ApiKeyGetter = (extra) => {
    if (typeof apiKeyOrGetter === 'function') {
      return apiKeyOrGetter(extra);
    }
    return apiKeyOrGetter;
  };
  const projectRoot = process.cwd();
  const specsDir = `${projectRoot}/openapi-schemas`;
  const specs = loadOpenAPISpecs(specsDir);
  const endpoints = new Map<string, any>();

  for (const [, spec] of specs.entries()) {
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

  for (const endpoint of endpoints.values()) {
    const inputSchema = createZodShape(endpoint);
    server.tool(
      endpoint.operationId,
      endpoint.description || endpoint.summary,
      inputSchema as any,
      async (args: any, extra: { authInfo?: { extra?: { apiKey?: string } } }) => {
        const apiKey = getApiKey(extra) || process.env.LITEAPI_API_KEY;
        if (!apiKey) throw new Error('API key not found. Pass ?apiKey= in URL or set LITEAPI_API_KEY.');
        try {
          const pathParams: Record<string, any> = {};
          const queryParams: Record<string, any> = {};
          let body: any = undefined;
          const pathParamNames = endpoint.parameters.filter((p: any) => p.in === 'path').map((p: any) => p.name);
          const queryParamNames = endpoint.parameters.filter((p: any) => p.in === 'query').map((p: any) => p.name);

          for (const [key, value] of Object.entries(args || {})) {
            if (pathParamNames.includes(key)) pathParams[key] = value;
            else if (queryParamNames.includes(key)) queryParams[key] = value;
            else {
              if (body === undefined) body = {};
              body[key] = value;
            }
          }

          if (endpoint.requestBody && Object.keys(pathParams).length === 0 && Object.keys(queryParams).length === 0) {
            body = args;
          } else if (endpoint.requestBody) {
            const bodyKeys = Object.keys(args || {}).filter((k) => !pathParamNames.includes(k) && !queryParamNames.includes(k));
            if (bodyKeys.length > 0) {
              body = {};
              for (const key of bodyKeys) body[key] = args[key];
            }
          }

          const result = await makeAPIRequest(
            endpoint.baseUrl,
            endpoint.method,
            endpoint.path,
            apiKey,
            { ...pathParams, ...queryParams },
            body
          );
          return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          return { content: [{ type: 'text' as const, text: `Error: ${msg}` }], isError: true };
        }
      }
    );
  }
}
