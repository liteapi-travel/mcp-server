import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z, ZodRawShape } from "zod";
import axios from "axios";

export function registerToolsFromOpenApi(server: McpServer, spec: any) {
  const paths = spec.paths;

  for (const [routeTemplate, methods] of Object.entries(paths)) {
    if (typeof methods !== 'object' || methods === null) continue;

    for (const [method, op] of Object.entries(methods as Record<string, any>)) {
      let operationId = (op.operationId || op.summary || '').replace(/\s/g, '-');

      if (!operationId) continue;

      operationId = operationId.toLowerCase().replace(/[^A-z0-9_-]/gm, '').substring(0, 64);

      const parameters = op.parameters || [];
      const requestBodySchema = op.requestBody?.content?.['application/json']?.schema;

      const schemaShape: ZodRawShape = {};
      const paramMetadata: {
        in: "query" | "path" | "header" | "cookie",
        name: string
      }[] = [];

      for (const param of parameters) {
        const { name, schema, in: paramIn } = param;
        schemaShape[name] = createZodSchema(schema);
        paramMetadata.push({ in: paramIn, name });
      }

      if (requestBodySchema?.properties) {
        for (const [key, prop] of Object.entries<any>(requestBodySchema.properties)) {
          schemaShape[key] = createZodSchema(prop);
        }
      }

      server.tool(operationId, op.summary || op.description, schemaShape, async (args) => {
        const path = buildPath(routeTemplate, args);
        const queryParams: any = {};
        const bodyParams: any = {};

        for (const meta of paramMetadata) {
          if (meta.in === "query") {
            queryParams[meta.name] = args[meta.name];
          }
        }

        // Body: only if method allows
        if (["post", "put", "patch"].includes(method.toLowerCase()) && requestBodySchema) {
          for (const key of Object.keys(requestBodySchema.properties || {})) {
            if (key in args) {
              bodyParams[key] = args[key];
            }
          }
        }

        const url = `${spec.servers[0].url}${path}`;

        // console.log(`🔌 Calling ${method.toUpperCase()} ${url} with params:`, { queryParams, bodyParams });

        try {
          const response = await axios.request({
            method,
            headers: {
              'X-Api-Key': 'sand_c0155ab8-c683-4f26-8f94-b5e92c5797b9',
            },
            url,
            params: queryParams,
            data: Object.keys(bodyParams).length > 0 ? bodyParams : undefined,
          });

          return {
            content: [{
              type: "text",
              text: JSON.stringify(response.data, null, 2)
            }]
          };
        } catch (err: any) {
          return {
            isError: true,
            content: [{
              type: "text",
              text: JSON.stringify(err.response.data, null, 2)
            }]
          };
        }
      });

      //console.log(`🔌 Wired tool: ${operationId} → ${method.toUpperCase()} ${routeTemplate}`);
    }
  }
}

function buildPath(template: string, args: Record<string, any>) {
  return template.replace(/{(\w+)}/g, (_, key) => {
    if (args[key] == null) throw new Error(`Missing path param: ${key}`);
    return encodeURIComponent(args[key]);
  });
}

function mapOpenApiTypeToZod(type: string, required: boolean) {
  let zType: any;
  switch (type) {
    case 'string': zType = z.string(); break;
    case 'number': zType = z.number(); break;
    case 'integer': zType = z.number().int(); break;
    case 'boolean': zType = z.boolean(); break;
    default: zType = z.any(); break;
  }
  return required ? zType : zType.optional();
}

// Create a zod schema from a JSON Schema object
function createZodSchema(schema: any): z.ZodTypeAny {
  const type = schema.type;

  if (type === 'string') {
    return z.string();
  } else if (type === 'number') {
    return z.number();
  } else if (type === 'integer') {
    return z.number().int();
  } else if (type === 'boolean') {
    return z.boolean();
  } else if (type === 'array') {
    const items = schema.items || {};
    return z.array(createZodSchema(items));
  } else if (type === 'object') {
    const properties = schema.properties || {};
    const shape: Record<string, z.ZodTypeAny> = {};

    for (const [key, value] of Object.entries(properties)) {
      shape[key] = createZodSchema(value as any);
    }

    let baseSchema = z.object(shape);

    // Handle required properties
    if (schema.required && Array.isArray(schema.required)) {
      const requiredShape: Record<string, z.ZodTypeAny> = {};

      for (const key of Object.keys(shape)) {
        const isRequired = schema.required.includes(key);
        requiredShape[key] = isRequired ? shape[key] : shape[key].optional();
      }

      baseSchema = z.object(requiredShape);
    }

    return baseSchema;
  } else {
    return z.any();
  }
}
