/**
 * MCP tools registration - shared logic for OpenAPI-based tools
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
import { makeAPIRequest } from '../src/utils/api-client';
import { loadEndpointMap, wiringForEndpoint } from '../src/utils/catalog';
import { registerDiscoveryTools } from '../src/utils/discovery-tools';
import { createToolInputShape } from '../src/utils/schema-converter';

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

export type ApiKeyGetter = (extra?: { authInfo?: { extra?: { apiKey?: string } } }) => string | undefined;

export function registerLiteApiTools(server: McpServer, apiKeyOrGetter: string | ApiKeyGetter) {
  const getApiKey: ApiKeyGetter = (extra) => {
    const value = typeof apiKeyOrGetter === 'function' ? apiKeyOrGetter(extra) : apiKeyOrGetter;
    return value || undefined;
  };
  const endpoints = loadEndpointMap();
  registerDiscoveryTools(server, endpoints);

  for (const endpoint of endpoints.values()) {
    const inputSchema = createToolInputShape(endpoint);
    const annotations = getToolAnnotations(endpoint.method, endpoint.operationId);
    server.tool(
      endpoint.operationId,
      endpoint.description || endpoint.summary,
      inputSchema as any,
      annotations,
      async (args: any, extra: { authInfo?: { extra?: { apiKey?: string } } }) => {
        const apiKey = getApiKey(extra);
        if (!apiKey) {
          return {
            content: [{ type: 'text' as const, text: JSON.stringify(wiringForEndpoint(endpoint), null, 2) }],
          };
        }
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
