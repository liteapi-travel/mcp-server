export const MCP_ISSUER = 'https://mcp.liteapi.travel';
export const MCP_RESOURCE = 'https://mcp.liteapi.travel/api/mcp';

const AUTHORIZE_URL =
  process.env.MCP_OAUTH_AUTHORIZE_URL || 'https://connect.nuitee.com/oauth/mcp/authorize';

export function authorizationServerMetadata() {
  return {
    issuer: MCP_ISSUER,
    authorization_endpoint: AUTHORIZE_URL,
    token_endpoint: `${MCP_ISSUER}/oauth/token`,
    registration_endpoint: `${MCP_ISSUER}/oauth/register`,
    revocation_endpoint: `${MCP_ISSUER}/oauth/revoke`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none'],
    authorization_response_iss_parameter_supported: true,
    scopes_supported: ['mcp'],
  };
}

export function protectedResourceMetadata() {
  return {
    resource: MCP_RESOURCE,
    authorization_servers: [MCP_ISSUER],
    bearer_methods_supported: ['header'],
    scopes_supported: ['mcp'],
  };
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Cache-Control': 'no-store',
};

export function jsonMetadata(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

export function corsPreflight(): Response {
  return new Response(null, { status: 204, headers: CORS });
}
