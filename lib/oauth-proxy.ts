const API = (process.env.DASHBOARD_API_URL || 'https://da.liteapi.travel').replace(/\/$/, '');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Cache-Control': 'no-store',
};

export function oauthPreflight(): Response {
  return new Response(null, { status: 204, headers: CORS });
}

/** Forward a token, register, or revoke call to the dashboard API. */
export async function proxyOauth(path: string, req: Request): Promise<Response> {
  const body = await req.text();
  const contentType = req.headers.get('content-type') || 'application/x-www-form-urlencoded';
  let upstream: Response;
  try {
    upstream = await fetch(`${API}${path}`, {
      method: 'POST',
      headers: { 'content-type': contentType },
      body,
    });
  } catch {
    return new Response(JSON.stringify({ error: 'temporarily_unavailable' }), {
      status: 503,
      headers: { ...CORS, 'Content-Type': 'application/json', 'Retry-After': '30' },
    });
  }
  const text = await upstream.text();
  const headers: Record<string, string> = {
    ...CORS,
    'Content-Type': upstream.headers.get('content-type') || 'application/json',
  };
  const retry = upstream.headers.get('retry-after');
  if (retry) headers['Retry-After'] = retry;
  return new Response(text, { status: upstream.status, headers });
}
