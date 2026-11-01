import { join } from 'path';
import {
  loadOpenAPISpecs,
  parseEndpoints,
  type OpenAPISchema,
  type ParsedEndpoint,
} from './openapi-parser.js';

const DOCS_URL = /https:\/\/docs\.liteapi\.travel\/[^\s)"']+/g;

export function loadEndpointMap(specsDir = join(process.cwd(), 'openapi-schemas')): Map<string, ParsedEndpoint> {
  const endpoints = new Map<string, ParsedEndpoint>();
  const specs = loadOpenAPISpecs(specsDir);
  for (const spec of specs.values()) {
    for (const endpoint of parseEndpoints(spec)) {
      let name = endpoint.operationId;
      let counter = 1;
      while (endpoints.has(name)) {
        name = `${endpoint.operationId}_${counter}`;
        counter++;
      }
      endpoints.set(name, { ...endpoint, operationId: name });
    }
  }
  return endpoints;
}

export function searchEndpoints(
  endpoints: Map<string, ParsedEndpoint>,
  query = '',
  method?: string,
  limit = 25
): { total: number; endpoints: Array<{ name: string; method: string; path: string; host: string; summary: string; tags: string[] }> } {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const cap = Math.min(Math.max(limit, 1), 50);
  const rows = [];
  for (const endpoint of endpoints.values()) {
    if (method && endpoint.method !== method.toUpperCase()) continue;
    const hay = `${endpoint.operationId} ${endpoint.method} ${endpoint.path} ${endpoint.summary} ${endpoint.tags.join(' ')}`.toLowerCase();
    if (terms.length > 0 && !terms.every((term) => hay.includes(term))) continue;
    rows.push({
      name: endpoint.operationId,
      method: endpoint.method,
      path: endpoint.path,
      host: endpoint.baseUrl,
      summary: endpoint.summary.split('\n')[0].slice(0, 180),
      tags: endpoint.tags,
    });
  }
  return { total: rows.length, endpoints: rows.slice(0, cap) };
}

export function findEndpoint(
  endpoints: Map<string, ParsedEndpoint>,
  name?: string,
  path?: string,
  method?: string
): ParsedEndpoint | ParsedEndpoint[] | undefined {
  if (name) {
    const exact = endpoints.get(name);
    if (exact) return exact;
    const matches = [...endpoints.values()].filter((endpoint) => endpoint.operationId.includes(name));
    if (matches.length === 1) return matches[0];
    if (matches.length > 1) return matches.slice(0, 15);
  }
  if (path) {
    const matches = [...endpoints.values()].filter((endpoint) => {
      if (endpoint.path !== path) return false;
      if (method && endpoint.method !== method.toUpperCase()) return false;
      return true;
    });
    if (matches.length === 1) return matches[0];
    if (matches.length > 1) return matches;
  }
  return undefined;
}

function summarizeSchema(schema: OpenAPISchema | undefined, depth = 0): unknown {
  if (!schema) return undefined;
  if (depth > 2) return schema.type || 'object';
  const description = schema.description ? schema.description.slice(0, 160) : undefined;
  if (schema.enum && schema.enum.length > 0) {
    return { type: schema.type || 'string', enum: schema.enum.slice(0, 12), description };
  }
  if (schema.type === 'array') {
    return { type: 'array', items: summarizeSchema(schema.items, depth + 1), description };
  }
  if (schema.properties) {
    const properties: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(schema.properties).slice(0, 40)) {
      properties[key] = summarizeSchema(value, depth + 1);
    }
    return { type: 'object', required: schema.required, properties, description };
  }
  const variants = schema.anyOf || schema.oneOf;
  if (variants && variants.length > 0) {
    return { oneOf: variants.slice(0, 4).map((item) => summarizeSchema(item, depth + 1)), description };
  }
  return { type: schema.type || 'any', format: schema.format, description };
}

export function wiringForEndpoint(endpoint: ParsedEndpoint): Record<string, unknown> {
  const docs = [...endpoint.description.matchAll(DOCS_URL)].map((match) => match[0]).slice(0, 5);
  return {
    mode: 'wiring',
    message:
      'No API key on this connection, so this call was not sent. Call this URL from your server with X-API-Key. To execute this tool, reconnect with an X-API-Key header or ?apiKey=.',
    name: endpoint.operationId,
    summary: endpoint.summary.split('\n')[0].slice(0, 240),
    method: endpoint.method,
    url: joinUrl(endpoint.baseUrl, endpoint.path),
    headers: {
      'X-API-Key': '<LITEAPI_API_KEY>',
      accept: 'application/json',
      ...(endpoint.requestBody ? { 'content-type': 'application/json' } : {}),
    },
    parameters: endpoint.parameters.map((param) => ({
      name: param.name,
      in: param.in,
      required: Boolean(param.required),
      description: param.description ? param.description.slice(0, 160) : undefined,
      schema: summarizeSchema(param.schema),
    })),
    body: summarizeSchema(endpoint.requestBody),
    docs,
  };
}

function joinUrl(baseUrl: string, path: string): string {
  const base = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}
