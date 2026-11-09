import { createMcpHandler } from 'mcp-handler';
import { registerKnowledgeTools } from '../../../lib/knowledge-tools';

/**
 * Docs / knowledge MCP — catalog + public docs + dashboard-kb only.
 * No OpenAPI execute tools and no API key required.
 * Full booking MCP remains at /api/mcp.
 *
 * Do not set `basePath` here — mcp-handler would force `${basePath}/mcp`.
 * Point streamableHttpEndpoint at this route instead.
 */
const handler = createMcpHandler(
  async (server) => {
    registerKnowledgeTools(server);
  },
  {
    serverInfo: {
      name: 'nuitee-connect-knowledge',
      version: '1.0.0',
    },
  },
  {
    streamableHttpEndpoint: '/api/knowledge',
    disableSse: true,
    maxDuration: 60,
    verboseLogs: process.env.NODE_ENV === 'development',
  }
);

export { handler as GET, handler as POST, handler as DELETE };
