import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z, ZodRawShape } from "zod";

export function registerToolsFromOpenApi(server: McpServer, spec: any) {
  const paths = spec.paths;

  console.log(`🛠 Registering tools from OpenAPI spec...`, spec.info.title);

  for (const [route, methods] of Object.entries(paths)) {
    const typedMethods = methods as Record<string, any>;

    for (const [method, op] of Object.entries(typedMethods)) {
      let operationId = (op.operationId || op.summary || '').replace(/\s/g, '-');

      if (!operationId) continue;

      operationId = `${method.toLowerCase()}-${operationId.toLowerCase()}`;

      const parameters = op.parameters || [];
      const requestBody = op.requestBody?.content?.['application/json']?.schema;

      // Create zod schema from OpenAPI schema (basic mapping)
      const schemaShape: ZodRawShape = {};

      // Add query/path params
      for (const param of parameters) {
        const name = param.name;
        const required = param.required || false;
        const type = param.schema?.type || 'string';
        schemaShape[name] = mapOpenApiTypeToZod(type, required);
      }

      // Add body parameters (flattened)
      if (requestBody?.properties) {
        for (const [key, prop] of Object.entries<any>(requestBody.properties)) {
          const required = requestBody.required?.includes(key) ?? false;
          const type = prop.type || 'string';
          schemaShape[key] = mapOpenApiTypeToZod(type, required);
        }
      }

      const zodSchema = z.object(schemaShape);

      // Register the tool
      server.tool(operationId, schemaShape, async (args) => {
        return {
          content: [{
            type: "text",
            text: `Tool "${operationId}" was called with: ${JSON.stringify(args)}`
          }]
        };
      });

      console.log(`✅ Registered tool: ${operationId}`);
    }
  }
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
