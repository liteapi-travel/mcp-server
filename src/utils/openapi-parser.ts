import { readFileSync } from 'fs';
import { join } from 'path';

export interface OpenAPISpec {
  openapi: string;
  info: {
    title: string;
    version: string;
  };
  servers?: Array<{ url: string; description?: string }>;
  paths: Record<string, Record<string, OpenAPIOperation>>;
  components?: {
    securitySchemes?: Record<string, any>;
    schemas?: Record<string, OpenAPISchema>;
  };
  security?: Array<Record<string, any>>;
}

export interface OpenAPIOperation {
  tags?: string[];
  summary?: string;
  description?: string;
  operationId?: string;
  parameters?: OpenAPIParameter[];
  requestBody?: {
    content?: {
      'application/json'?: {
        schema?: OpenAPISchema;
      };
    };
  };
  responses?: Record<string, any>;
}

export interface OpenAPIParameter {
  name: string;
  in: 'path' | 'query' | 'header';
  required?: boolean;
  schema?: OpenAPISchema;
  description?: string;
}

export interface OpenAPISchema {
  type?: string;
  properties?: Record<string, OpenAPISchema>;
  required?: string[];
  items?: OpenAPISchema;
  enum?: any[];
  format?: string;
  description?: string;
  example?: any;
  oneOf?: OpenAPISchema[];
  anyOf?: OpenAPISchema[];
  allOf?: OpenAPISchema[];
}

export interface ParsedEndpoint {
  method: string;
  path: string;
  operationId: string;
  summary: string;
  description: string;
  tags: string[];
  parameters: OpenAPIParameter[];
  requestBody?: OpenAPISchema;
  baseUrl: string;
}

export function loadOpenAPISpecs(specsDir: string): Map<string, OpenAPISpec> {
  const specs = new Map<string, OpenAPISpec>();
  const specFiles = [
    'search.json',
    'booking.json',
    'voucher.json',
    'analytics.json',
    'static.json',
    'loyalty.json',
    'supplyCustomization.json',
    'prices.json',
    'flights.json',
    'experiences.json',
  ];

  for (const file of specFiles) {
    try {
      const filePath = join(specsDir, file);
      const content = readFileSync(filePath, 'utf-8');
      const spec: OpenAPISpec = JSON.parse(content);
      const specName = file.replace('.json', '');
      specs.set(specName, spec);
    } catch (error) {
      console.error(`Failed to load ${file}:`, error);
    }
  }

  return specs;
}

/**
 * Recursively resolves $ref references in an OpenAPI schema using the spec's
 * components/schemas definitions. A `seen` set guards against circular refs.
 */
export function resolveRefs(
  schema: OpenAPISchema,
  spec: OpenAPISpec,
  seen: Set<string> = new Set()
): OpenAPISchema {
  if (!schema || typeof schema !== 'object') return schema;

  const raw = schema as any;
  if (raw.$ref) {
    const ref: string = raw.$ref;
    if (seen.has(ref)) return {};
    if (ref.startsWith('#/components/schemas/')) {
      const name = ref.replace('#/components/schemas/', '');
      const resolved = spec.components?.schemas?.[name];
      if (resolved) {
        return resolveRefs(resolved, spec, new Set([...seen, ref]));
      }
    }
    return {};
  }

  const result: OpenAPISchema = { ...schema };

  if (result.items) {
    result.items = resolveRefs(result.items, spec, seen);
  }

  if (result.properties) {
    const props: Record<string, OpenAPISchema> = {};
    for (const [key, propSchema] of Object.entries(result.properties)) {
      props[key] = resolveRefs(propSchema, spec, seen);
    }
    result.properties = props;
  }

  if (result.oneOf) {
    result.oneOf = result.oneOf.map((s) => resolveRefs(s, spec, seen));
  }
  if (result.anyOf) {
    result.anyOf = result.anyOf.map((s) => resolveRefs(s, spec, seen));
  }
  if (result.allOf) {
    result.allOf = result.allOf.map((s) => resolveRefs(s, spec, seen));
  }

  return result;
}

/**
 * Sanitizes a tool name to conform to MCP naming conventions.
 * Allowed characters: A-Z, a-z, 0-9, underscore (_), dash (-), and dot (.)
 */
function sanitizeOperationId(operationId: string): string {
  // Replace spaces and invalid characters with underscores
  // Keep only: letters, numbers, underscore, dash, and dot
  let sanitized = operationId
    .replace(/\s+/g, '_') // Replace spaces with underscore
    .replace(/[^a-zA-Z0-9_.-]/g, '_') // Replace invalid chars with underscore
    .replace(/_{2,}/g, '_') // Replace multiple underscores with single
    .replace(/^_+|_+$/g, ''); // Remove leading/trailing underscores

  // Ensure it starts with a letter or underscore
  if (sanitized.length === 0 || /^[0-9]/.test(sanitized)) {
    sanitized = `tool_${sanitized}`;
  }

  return sanitized;
}

export function parseEndpoints(spec: OpenAPISpec): ParsedEndpoint[] {
  const endpoints: ParsedEndpoint[] = [];
  const baseUrl = spec.servers?.[0]?.url || 'https://api.liteapi.travel/v3.0';

  for (const [path, methods] of Object.entries(spec.paths)) {
    for (const [method, operation] of Object.entries(methods)) {
      if (!operation || typeof operation !== 'object') continue;

      const rawOperationId =
        operation.operationId ||
        `${method}_${path.replace(/[^a-zA-Z0-9]/g, '_')}`.toLowerCase();

      // Sanitize the operationId to ensure it's a valid tool name
      const operationId = sanitizeOperationId(rawOperationId);

      const rawRequestBodySchema =
        operation.requestBody?.content?.['application/json']?.schema;
      const requestBodySchema = rawRequestBodySchema
        ? resolveRefs(rawRequestBodySchema, spec)
        : undefined;

      const parameters = (operation.parameters || []).map((p) => ({
        ...p,
        schema: p.schema ? resolveRefs(p.schema, spec) : p.schema,
      }));

      endpoints.push({
        method: method.toUpperCase(),
        path,
        operationId,
        summary: operation.summary || operationId,
        description: operation.description || operation.summary || '',
        tags: operation.tags || [],
        parameters,
        requestBody: requestBodySchema,
        baseUrl,
      });
    }
  }

  return endpoints;
}
