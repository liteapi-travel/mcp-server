import { oauthPreflight, proxyOauth } from '../../../lib/oauth-proxy';

export function POST(req: Request) {
  return proxyOauth('/oauth/mcp/register', req);
}

export function OPTIONS() {
  return oauthPreflight();
}
