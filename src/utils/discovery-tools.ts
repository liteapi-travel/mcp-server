import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { findEndpoint, searchEndpoints, wiringForEndpoint } from './catalog.js';
import { fetchDocsPage, searchDocs } from './docs.js';
import type { ParsedEndpoint } from './openapi-parser.js';

const readOnly = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
};

export function registerDiscoveryTools(server: McpServer, endpoints: Map<string, ParsedEndpoint>) {
  server.tool(
    'list_endpoints',
    'List Nuitee Connect endpoints from the local OpenAPI catalog. Works without an API key. Use this to discover method, host, and path before writing server-side code.',
    {
      query: z.string().optional().describe('Words to match against name, path, summary, or tag. Example: "hotel rates" or "flights book".'),
      method: z.string().optional().describe('HTTP method filter, such as GET or POST.'),
      limit: z.number().int().optional().describe('Max rows. Default 25, max 50.'),
    },
    readOnly,
    async ({ query, method, limit }) => {
      const rows = searchEndpoints(endpoints, query || '', method, limit ?? 25);
      return text({
        mode: 'discovery',
        total: rows.total,
        endpoints: rows.endpoints,
      });
    }
  );

  server.tool(
    'describe_endpoint',
    'Return the HTTP contract for one Nuitee Connect endpoint: URL, headers, parameters, and body shape. Does not call the API. Use this to wire the endpoint into server-side code.',
    {
      name: z.string().optional().describe('Tool name from list_endpoints, such as post_hotels_rates.'),
      path: z.string().optional().describe('Path such as /hotels/rates. Pair with method when the path has more than one verb.'),
      method: z.string().optional().describe('HTTP method, used with path.'),
    },
    readOnly,
    async ({ name, path, method }) => {
      const found = findEndpoint(endpoints, name, path, method);
      if (!found) {
        return text({ error: 'No endpoint matched. Call list_endpoints first.' }, true);
      }
      if (Array.isArray(found)) {
        return text({
          error: 'More than one endpoint matched. Pass name, or path plus method.',
          matches: found.map((endpoint) => ({
            name: endpoint.operationId,
            method: endpoint.method,
            path: endpoint.path,
          })),
        }, true);
      }
      return text(wiringForEndpoint(found));
    }
  );

  server.tool(
    'search_docs',
    'Search public Nuitee Connect documentation pages on https://docs.liteapi.travel. Works without an API key. Follow a result with fetch_docs_page.',
    {
      query: z.string().describe('Search words, such as "prebook payment" or "flights".'),
      limit: z.number().int().optional().describe('Max results. Default 8, max 20.'),
    },
    readOnly,
    async ({ query, limit }) => {
      try {
        const results = await searchDocs(query, limit ?? 8);
        return text({ mode: 'docs', results });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return text({ error: message }, true);
      }
    }
  );

  server.tool(
    'fetch_docs_page',
    'Read one public docs page as plain text. URL must be on https://docs.liteapi.travel/. Works without an API key.',
    {
      url: z.string().describe('Full https://docs.liteapi.travel/... URL from search_docs.'),
    },
    readOnly,
    async ({ url }) => {
      try {
        const page = await fetchDocsPage(url);
        return text({ url, text: page });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return text({ error: message }, true);
      }
    }
  );
}

function text(value: unknown, isError = false) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }],
    ...(isError ? { isError: true } : {}),
  };
}
