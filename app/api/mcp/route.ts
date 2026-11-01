import { createMcpHandler, withMcpAuth } from 'mcp-handler';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import type { ApiKeyGetter } from '../../../lib/mcp-tools';
import { registerLiteApiTools } from '../../../lib/mcp-tools';
import { SANDBOX_SAMPLE_API_KEY } from '../../../src/utils/sandbox-key';

function getApiKeyFromRequest(req: Request): string | undefined {
  // Header first so the key is not written into access logs via the URL.
  const fromHeader = req.headers.get('x-api-key')?.trim();
  if (fromHeader) return fromHeader;
  try {
    const fromUrl = new URL(req.url).searchParams.get('apiKey')?.trim();
    if (fromUrl) return fromUrl;
  } catch {
    // Relative or empty URL. Fall through to Authorization.
  }
  const auth = req.headers.get('authorization');
  if (auth?.toLowerCase().startsWith('bearer ')) {
    const token = auth.slice(7).trim();
    if (token) return token;
  }
  return undefined;
}

const baseHandler = createMcpHandler(
  async (server) => {
    // Caller key wins. Otherwise sample calls use the shared sandbox key.
    // A server-wide LITEAPI_API_KEY is not used, so anonymous traffic cannot
    // spend a production key configured on the host.
    const getApiKey: ApiKeyGetter = (extra) => {
      const fromAuth = extra?.authInfo?.extra?.apiKey as string | undefined;
      return fromAuth || SANDBOX_SAMPLE_API_KEY;
    };
    registerLiteApiTools(server, getApiKey);
  },
  {},
  {
    basePath: '/api',
    maxDuration: 60,
    verboseLogs: process.env.NODE_ENV === 'development',
  }
);

/**
 * Key from the request, when present. No key still opens the session.
 * Tool calls then use the shared sandbox key.
 */
function verifyApiKey(req: Request, bearerToken?: string): AuthInfo | undefined {
  const apiKey = getApiKeyFromRequest(req) || bearerToken;
  if (!apiKey) return undefined;
  return {
    token: apiKey,
    scopes: [],
    clientId: 'liteapi-client',
    extra: { apiKey },
  };
}

const handler = withMcpAuth(baseHandler, verifyApiKey, {
  required: false, // No key: sample calls run with the shared sandbox key
});

export { handler as GET, handler as POST, handler as DELETE };
