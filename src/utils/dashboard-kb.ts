const API = (process.env.DASHBOARD_API_URL || 'https://da.liteapi.travel').replace(/\/$/, '');
const TIMEOUT_MS = 15000;

export type DashboardKbMatch = {
  slug: string;
  title: string;
  navPath: string;
  dashboardPath: string;
  summary: string;
};

export type DashboardKbFeature = {
  slug: string;
  title: string;
  navPath: string;
  dashboardPath: string;
  markdown: string;
};

export async function searchDashboardKb(
  query: string,
  limit = 8
): Promise<{ matches: DashboardKbMatch[] }> {
  const params = new URLSearchParams({ q: query });
  if (limit != null) params.set('limit', String(limit));
  const response = await fetch(`${API}/mcp/dashboard-kb/search?${params}`, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error(await errorMessage(response, 'Dashboard KB search'));
  }
  return (await response.json()) as { matches: DashboardKbMatch[] };
}

export async function fetchDashboardFeature(slug: string): Promise<DashboardKbFeature> {
  const trimmed = slug.trim();
  if (!trimmed) {
    throw new Error('slug is required');
  }
  const response = await fetch(`${API}/mcp/dashboard-kb/${encodeURIComponent(trimmed)}`, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error(await errorMessage(response, 'Dashboard KB fetch'));
  }
  return (await response.json()) as DashboardKbFeature;
}

async function errorMessage(response: Response, label: string): Promise<string> {
  let detail = '';
  try {
    const body = (await response.json()) as { error?: string; code?: string };
    detail = body.error || body.code || '';
  } catch {
    // ignore
  }
  const suffix = detail ? `: ${detail}` : '';
  return `${label} returned ${response.status}${suffix}`;
}
