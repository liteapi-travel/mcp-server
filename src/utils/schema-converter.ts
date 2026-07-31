import { z } from 'zod';
import { OpenAPISchema } from './openapi-parser.js';

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

  // Handle enum
  if (schema.enum && schema.enum.length > 0) {
    return z.enum(schema.enum as [string, ...string[]]);
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
