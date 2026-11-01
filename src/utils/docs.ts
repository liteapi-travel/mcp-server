const SITEMAP_URL = 'https://docs.liteapi.travel/sitemap.xml';
const DOCS_HOST = 'docs.liteapi.travel';
const SITEMAP_TTL_MS = 24 * 60 * 60 * 1000;
const PAGE_CHAR_LIMIT = 12000;

let sitemapCache: { at: number; urls: string[] } | null = null;

export async function searchDocs(query: string, limit = 8): Promise<Array<{ url: string; title: string }>> {
  const urls = await loadSitemap();
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const cap = Math.min(Math.max(limit, 1), 20);
  const scored = urls
    .map((url) => {
      const hay = url.toLowerCase();
      const score = terms.reduce((sum, term) => sum + (hay.includes(term) ? 1 : 0), 0);
      return { url, score };
    })
    .filter((row) => terms.length === 0 || row.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, cap);
  return scored.map((row) => ({
    url: row.url,
    title: titleFromUrl(row.url),
  }));
}

export async function fetchDocsPage(rawUrl: string): Promise<string> {
  const url = assertDocsUrl(rawUrl);
  const response = await fetch(url, {
    redirect: 'follow',
    signal: AbortSignal.timeout(15000),
    headers: { accept: 'text/html,application/json' },
  });
  assertDocsUrl(response.url);
  if (!response.ok) {
    throw new Error(`Docs page returned ${response.status}`);
  }
  const body = await response.text();
  const text = stripHtml(body).slice(0, PAGE_CHAR_LIMIT);
  const truncated = stripHtml(body).length > PAGE_CHAR_LIMIT;
  return truncated ? `${text}\n\n[truncated]` : text;
}

async function loadSitemap(): Promise<string[]> {
  if (sitemapCache && Date.now() - sitemapCache.at < SITEMAP_TTL_MS) {
    return sitemapCache.urls;
  }
  const response = await fetch(SITEMAP_URL, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) {
    throw new Error(`Sitemap returned ${response.status}`);
  }
  const xml = await response.text();
  const urls = [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)]
    .map((match) => match[1])
    .filter((url) => {
      try {
        return new URL(url).hostname === DOCS_HOST;
      } catch {
        return false;
      }
    });
  sitemapCache = { at: Date.now(), urls };
  return urls;
}

function assertDocsUrl(rawUrl: string): string {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error('Docs URL must be on https://docs.liteapi.travel/');
  }
  if (parsed.protocol !== 'https:' || parsed.hostname !== DOCS_HOST) {
    throw new Error('Docs URL must be on https://docs.liteapi.travel/');
  }
  return parsed.toString();
}

function titleFromUrl(url: string): string {
  const path = new URL(url).pathname.replace(/\/$/, '');
  const slug = path.split('/').filter(Boolean).pop() || 'docs';
  return slug.replace(/[-_]/g, ' ');
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}
