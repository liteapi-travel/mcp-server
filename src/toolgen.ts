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

      operationId = `${method.toLowerCase()}-${operationId.toLowerCase()}`;

      const parameters = op.parameters || [];
      const requestBodySchema = op.requestBody?.content?.['application/json']?.schema;

      const schemaShape: ZodRawShape = {};
      const paramMetadata: {
        in: "query" | "path" | "header" | "cookie",
        name: string
      }[] = [];

      for (const param of parameters) {
        const { name, required, schema, in: paramIn } = param;
        const type = schema?.type || 'string';
        schemaShape[name] = mapOpenApiTypeToZod(type, required ?? false);
        paramMetadata.push({ in: paramIn, name });
      }

      if (requestBodySchema?.properties) {
        for (const [key, prop] of Object.entries<any>(requestBodySchema.properties)) {
          const required = requestBodySchema.required?.includes(key) ?? false;
          const type = prop.type || 'string';
          schemaShape[key] = mapOpenApiTypeToZod(type, required);
        }
      }

      server.tool(operationId, schemaShape, async (args) => {
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

        console.log(`🔌 Calling ${method.toUpperCase()} ${url} with params:`, { queryParams, bodyParams });

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
              text: `✅ ${method.toUpperCase()} ${path} returned:\n${JSON.stringify(response.data, null, 2)}`
            }]
          };
        } catch (err: any) {
          return {
            isError: true,
            content: [{
              type: "text",
              text: `❌ Error calling ${method.toUpperCase()} ${path}:\n${err?.response?.data ? JSON.stringify(err.response.data, null, 2) : err.message}`
            }]
          };
        }
      });

      console.log(`🔌 Wired tool: ${operationId} → ${method.toUpperCase()} ${routeTemplate}`);
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
