import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadOpenApiSpecs } from "./loader";
import { registerToolsFromOpenApi } from "./toolgen";

const server = new McpServer({
  name: "OpenAPI Tool Server",
  version: "1.0.0",
});

const specs = loadOpenApiSpecs('./openapi-schemas');
Object.values(specs).forEach(spec => {
  registerToolsFromOpenApi(server, spec);
});

const transport = new StdioServerTransport();

server.connect(transport);
