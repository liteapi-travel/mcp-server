const API = (process.env.DASHBOARD_API_URL || 'https://da.liteapi.travel').replace(/\/$/, '');

/** Same default as the dashboard API. MCP_OAUTH_SERVICE_TOKEN overrides it. */
const DEFAULT_MCP_OAUTH_SERVICE_TOKEN = 'f7dc405659b045ac3e8aaf77c45021d454cd234bff674adc960bb9d9b345302b';

export function isLiteApiKey(value: string): boolean {
  return /^(sand_|sandbox_|prod_)/.test(value);
}

export function isConnectOauthToken(value: string): boolean {
  return value.startsWith('ncmcp_') && !value.startsWith('ncmcp_rt_');
}

/**
 * Exchange a Connect OAuth access token for the user's LiteAPI key.
 * The service token stays on this host.
 */
export async function resolveConnectOauthToken(token: string): Promise<string | undefined> {
  const service = process.env.MCP_OAUTH_SERVICE_TOKEN?.trim() || DEFAULT_MCP_OAUTH_SERVICE_TOKEN;
  let response: Response;
  try {
    response = await fetch(`${API}/oauth/mcp/resolve`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${service}`,
      },
      body: JSON.stringify({ access_token: token }),
    });
  } catch {
    return undefined;
  }
  if (!response.ok) return undefined;
  const data = (await response.json().catch(() => null)) as { apiKey?: unknown } | null;
  const apiKey = typeof data?.apiKey === 'string' ? data.apiKey.trim() : '';
  if (!isLiteApiKey(apiKey)) return undefined;
  return apiKey;
}
