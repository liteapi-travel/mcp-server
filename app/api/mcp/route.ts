import { createMcpHandler, withMcpAuth } from 'mcp-handler';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import type { ApiKeyGetter } from '../../../lib/mcp-tools';
import { registerLiteApiTools } from '../../../lib/mcp-tools';

function getApiKeyFromRequest(req: Request): string | undefined {
  try {
    const url = new URL(req.url);
    const fromUrl = url.searchParams.get('apiKey');
    if (fromUrl) return fromUrl;
    const fromHeader = req.headers.get('X-Api-Key') || req.headers.get('x-api-key');
    if (fromHeader) return fromHeader;
    const auth = req.headers.get('Authorization');
    if (auth?.startsWith('Bearer ')) return auth.slice(7);
    return undefined;
  } catch {
    return undefined;
  }
}

const baseHandler = createMcpHandler(
  async (server) => {
    // ApiKey from extra.authInfo (set by withMcpAuth from URL/header) or env
    const getApiKey: ApiKeyGetter = (extra) => {
      const fromAuth = extra?.authInfo?.extra?.apiKey as string | undefined;
      if (fromAuth) return fromAuth;
      const fromEnv = process.env.LITEAPI_API_KEY;
      if (fromEnv) return fromEnv;
      throw new Error('API key required. Set LITEAPI_API_KEY in Vercel or pass ?apiKey= in URL');
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
 * Verify API key from URL or headers. When user passes ?apiKey=xxx, we use that.
 * Otherwise fall back to LITEAPI_API_KEY env (for single-tenant deployment).
 */
function verifyApiKey(req: Request, bearerToken?: string): AuthInfo | undefined {
  const apiKey = getApiKeyFromRequest(req) || bearerToken || process.env.LITEAPI_API_KEY;
  if (!apiKey) return undefined;
  return {
    token: apiKey,
    scopes: [],
    clientId: 'liteapi-client',
    extra: { apiKey },
  };
}

/**
 * Auth wrapper: extracts API key, passes to tools via auth context.
 * We need to create the server with the apiKey from the request.
 * mcp-handler creates server per-request - we need to pass apiKey to init.
 * The init doesn't receive the request. So we use env var for now.
 * For ?apiKey= in URL: we could wrap and set env temporarily - but that's racy.
 * Simpler: require LITEAPI_API_KEY in Vercel. User sets it. Done.
 * For multi-tenant (each user their own key): would need mcp-handler to support
 * passing request to init, or use Redis to store session -> apiKey.
 */
const handler = withMcpAuth(baseHandler, verifyApiKey, {
  required: false, // Allow unauthenticated if LITEAPI_API_KEY is set
});

export { handler as GET, handler as POST };
