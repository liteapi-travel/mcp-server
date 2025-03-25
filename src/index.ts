import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerToolsFromOpenApi } from "./toolgen";

const server = new McpServer({
  name: "LiteAPI MCP Server",
  version: "3.0.0",
});

const analytics = require('../openapi-schemas/analytics.json');
const booking = require('../openapi-schemas/booking.json');
const loyalty = require('../openapi-schemas/loyalty.json');
const search = require('../openapi-schemas/search.json');
const supplyCustomization = require('../openapi-schemas/supplyCustomization.json');
const voucher = require('../openapi-schemas/voucher.json');

registerToolsFromOpenApi(server, analytics);
registerToolsFromOpenApi(server, booking);
registerToolsFromOpenApi(server, loyalty);
registerToolsFromOpenApi(server, search);
registerToolsFromOpenApi(server, supplyCustomization);
registerToolsFromOpenApi(server, voucher);

const transport = new StdioServerTransport();

server.connect(transport);
