import { createMcpHandler, withMcpAuth } from 'mcp-handler';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import type { ApiKeyGetter } from '../../../lib/mcp-tools';
import { registerLiteApiTools } from '../../../lib/mcp-tools';
import { SANDBOX_SAMPLE_API_KEY } from '../../../src/utils/sandbox-key';
import {
  isConnectOauthToken,
  isLiteApiKey,
  resolveConnectOauthToken,
} from '../../../src/utils/oauth-token';

function headerOrQueryKey(req: Request): string | undefined {
  const fromHeader = req.headers.get('x-api-key')?.trim();
  if (fromHeader && isLiteApiKey(fromHeader)) return fromHeader;
  try {
    const fromUrl = new URL(req.url).searchParams.get('apiKey')?.trim();
    if (fromUrl && isLiteApiKey(fromUrl)) return fromUrl;
  } catch {
    // Relative or empty URL.
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

function authInfo(apiKey: string): AuthInfo {
  return {
    token: apiKey,
    scopes: ['mcp'],
    clientId: 'liteapi-client',
    extra: { apiKey },
  };
}

/**
 * X-API-Key and ?apiKey= stay LiteAPI keys. An OAuth bearer (`ncmcp_`) is
 * resolved to that user's key. No credential still opens the session and
 * tool calls use the shared sandbox key.
 */
async function verifyApiKey(req: Request, bearerToken?: string): Promise<AuthInfo | undefined> {
  const direct = headerOrQueryKey(req);
  if (direct) return authInfo(direct);

  const bearer = bearerToken?.trim();
  if (bearer && isConnectOauthToken(bearer)) {
    const apiKey = await resolveConnectOauthToken(bearer);
    if (!apiKey) throw new Error('invalid token');
    return authInfo(apiKey);
  }
  if (bearer && isLiteApiKey(bearer)) return authInfo(bearer);
  if (bearer) throw new Error('invalid token');
  return undefined;
}

const handler = withMcpAuth(baseHandler, verifyApiKey, {
  required: false, // No key: sample calls run with the shared sandbox key
});

export { handler as GET, handler as POST, handler as DELETE };
