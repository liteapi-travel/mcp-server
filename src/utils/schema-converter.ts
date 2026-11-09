import { z } from 'zod';
import { OpenAPISchema, ParsedEndpoint } from './openapi-parser';

type LiteralZod = z.ZodLiteral<string | number | boolean | null>;

function unionOfLiterals(literals: LiteralZod[]): z.ZodTypeAny {
  if (literals.length === 0) {
    return z.never();
  }
  if (literals.length === 1) {
    return literals[0];
  }
  return z.union(literals as [LiteralZod, LiteralZod, ...LiteralZod[]]);
}

/**
 * Builds a Zod schema for an OpenAPI enum, using the value types rather than
 * always coercing to z.enum (string-only).
 */
export function openAPIEnumToZod(enumValues: readonly unknown[], description = ''): z.ZodTypeAny {
  if (enumValues.length === 0) {
    return z.never().describe(description);
  }

  const valueKinds = new Set(enumValues.map((v) => typeof v));

  if (valueKinds.size === 1 && valueKinds.has('string')) {
    return z.enum(enumValues as [string, ...string[]]).describe(description);
  }

  if (valueKinds.size === 1 && valueKinds.has('number')) {
    const literals = enumValues.map((v) => z.literal(v as number));
    return unionOfLiterals(literals).describe(description);
  }

  if (valueKinds.size === 1 && valueKinds.has('boolean')) {
    const literals = enumValues.map((v) => z.literal(v as boolean));
    return unionOfLiterals(literals).describe(description);
  }

  const literals = enumValues.map((v) => z.literal(v as string | number | boolean | null));
  return unionOfLiterals(literals).describe(description);
}

/**
 * Converts OpenAPI schema to Zod schema
 */
export function openAPIToZod(schema: OpenAPISchema | undefined): z.ZodTypeAny {
  if (!schema) {
    return z.any();
  }

  // Handle oneOf, anyOf, allOf
  if (schema.oneOf && schema.oneOf.length > 0) {
    return z.union(schema.oneOf.map((s) => openAPIToZod(s)) as [z.ZodTypeAny, z.ZodTypeAny, ...z.ZodTypeAny[]]);
  }

  if (schema.anyOf && schema.anyOf.length > 0) {
    return z.union(schema.anyOf.map((s) => openAPIToZod(s)) as [z.ZodTypeAny, z.ZodTypeAny, ...z.ZodTypeAny[]]);
  }

  if (schema.allOf && schema.allOf.length > 0) {
    return z.intersection(
      openAPIToZod(schema.allOf[0]),
      schema.allOf.slice(1).reduce((acc, s) => z.intersection(acc, openAPIToZod(s)), openAPIToZod(schema.allOf[0]))
    );
  }

  // Handle enum (before type switch — OpenAPI enums may be integer, number, or string)
  if (schema.enum && schema.enum.length > 0) {
    return openAPIEnumToZod(schema.enum, schema.description || '');
  }

  // Handle different types
  switch (schema.type) {
    case 'string':
      if (schema.format === 'date') {
        return z.string().describe(schema.description || 'Date in YYYY-MM-DD format');
      }
      if (schema.format === 'date-time') {
        return z.string().datetime().describe(schema.description || 'ISO 8601 datetime');
      }
      return z.string().describe(schema.description || '');
    
    case 'number':
    case 'integer':
      const numSchema = schema.type === 'integer' ? z.number().int() : z.number();
      return numSchema.describe(schema.description || '');
    
    case 'boolean':
      return z.boolean().describe(schema.description || '');
    
    case 'array':
      if (schema.items) {
        return z.array(openAPIToZod(schema.items)).describe(schema.description || '');
      }
      return z.array(z.any()).describe(schema.description || '');
    
    case 'object':
      if (schema.properties) {
        const shape: Record<string, z.ZodTypeAny> = {};
        for (const [key, propSchema] of Object.entries(schema.properties)) {
          const zodSchema = openAPIToZod(propSchema);
          const isRequired = schema.required?.includes(key);
          shape[key] = isRequired ? zodSchema : zodSchema.optional();
        }
        return z.object(shape).describe(schema.description || '');
      }
      return z.record(z.any()).describe(schema.description || '');
    
    default:
      return z.any().describe(schema.description || '');
  }
}

/**
 * Creates a Zod schema for endpoint parameters
 */
export function createParameterSchema(
  parameters: Array<{ name: string; required?: boolean; schema?: OpenAPISchema; description?: string }>
): z.ZodObject<any> {
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const param of parameters) {
    const zodSchema = param.schema
      ? openAPIToZod(param.schema)
      : z.string().describe(param.description || '');
    
    shape[param.name] = param.required
      ? zodSchema.describe(param.description || '')
      : zodSchema.optional().describe(param.description || '');
  }

  return z.object(shape);
}

/**
 * Creates a Zod schema for request body
 */
export function createRequestBodySchema(requestBody?: OpenAPISchema): z.ZodTypeAny {
  if (!requestBody) {
    return z.object({});
  }
  return openAPIToZod(requestBody);
}

/**
 * Zod shape for an MCP tool input (path, query, and flattened request-body fields).
 */
export function createToolInputShape(endpoint: ParsedEndpoint): Record<string, z.ZodTypeAny> {
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const param of endpoint.parameters.filter((p) => p.in === 'path')) {
    const zodSchema = param.schema ? openAPIToZod(param.schema) : z.string();
    shape[param.name] = zodSchema.describe(param.description || '');
  }

  for (const param of endpoint.parameters.filter((p) => p.in === 'query')) {
    const zodSchema = param.schema ? openAPIToZod(param.schema) : z.string();
    shape[param.name] = param.required
      ? zodSchema.describe(param.description || '')
      : zodSchema.optional().describe(param.description || '');
  }

  if (endpoint.requestBody?.properties) {
    for (const [key, propSchema] of Object.entries(endpoint.requestBody.properties)) {
      const zodSchema = openAPIToZod(propSchema);
      const isRequired = endpoint.requestBody.required?.includes(key);
      shape[key] = isRequired
        ? zodSchema.describe(propSchema.description || '')
        : zodSchema.optional().describe(propSchema.description || '');
    }
  }

  return shape;
}
