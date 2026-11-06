/**
 * Documentation + product KB tools only (no live API execute tools).
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { loadEndpointMap } from '../src/utils/catalog';
import { registerDiscoveryTools } from '../src/utils/discovery-tools';

export function registerKnowledgeTools(server: McpServer) {
  const endpoints = loadEndpointMap();
  registerDiscoveryTools(server, endpoints);
}
