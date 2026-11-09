import { readFile } from 'fs/promises';
import { join } from 'path';
import { fetchDocsPage } from './docs';

const PAGE_CHAR_LIMIT = 120000;

/** Keys match Ask Connect / Slack `fetch_documentation`. */
export const DOCUMENTATION_KEYS = [
  'mainDocs',
  'overview',
  'searchApi',
  'bookingApi',
  'hotelDataApi',
  'loyaltyApi',
  'voucherApi',
  'analyticsApi',
  'priceIndexApi',
  'flightsIndexApi',
] as const;

export type DocumentationKey = (typeof DOCUMENTATION_KEYS)[number];

const LOCAL_SCHEMA: Partial<Record<DocumentationKey, string>> = {
  searchApi: 'search.json',
  bookingApi: 'booking.json',
  hotelDataApi: 'static.json',
  loyaltyApi: 'loyalty.json',
  voucherApi: 'voucher.json',
  analyticsApi: 'analytics.json',
  priceIndexApi: 'prices.json',
  flightsIndexApi: 'flights.json',
};

const DOCS_PAGES: Partial<Record<DocumentationKey, string>> = {
  mainDocs: 'https://docs.liteapi.travel/',
  overview: 'https://docs.liteapi.travel/reference/overview',
};

export function isDocumentationKey(value: string): value is DocumentationKey {
  return (DOCUMENTATION_KEYS as readonly string[]).includes(value);
}

/**
 * Load a curated docs/OpenAPI blob by key. Specs come from local openapi-schemas
 * when present; mainDocs/overview fetch docs.liteapi.travel.
 */
export async function fetchDocumentation(key: string): Promise<{
  key: DocumentationKey;
  source: string;
  text: string;
  truncated: boolean;
}> {
  if (!isDocumentationKey(key)) {
    throw new Error(
      `Unknown documentation key. Use one of: ${DOCUMENTATION_KEYS.join(', ')}`
    );
  }

  const schemaFile = LOCAL_SCHEMA[key];
  if (schemaFile) {
    const path = join(process.cwd(), 'openapi-schemas', schemaFile);
    const raw = await readFile(path, 'utf8');
    const truncated = raw.length > PAGE_CHAR_LIMIT;
    return {
      key,
      source: `openapi-schemas/${schemaFile}`,
      text: truncated ? `${raw.slice(0, PAGE_CHAR_LIMIT)}\n\n[truncated]` : raw,
      truncated,
    };
  }

  const url = DOCS_PAGES[key];
  if (!url) {
    throw new Error(`No source configured for key ${key}`);
  }
  const page = await fetchDocsPage(url);
  return { key, source: url, text: page, truncated: page.includes('[truncated]') };
}
