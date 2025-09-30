import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerToolsFromOpenApi } from "./toolgen";
import { z } from "zod";

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
const staticData = require('../openapi-schemas/static.json');

registerToolsFromOpenApi(server, analytics);
registerToolsFromOpenApi(server, booking);
registerToolsFromOpenApi(server, loyalty);
registerToolsFromOpenApi(server, search);
registerToolsFromOpenApi(server, supplyCustomization);
registerToolsFromOpenApi(server, staticData);
registerToolsFromOpenApi(server, voucher);

// Register custom booking completion tool
server.tool(
  "complete-booking",
  "Complete a hotel booking by opening the booking URL with the provided parameters",
  {
    hotelId: z.string().describe("The hotel ID (e.g., 'lp39590')"),
    checkin: z.string().describe("Check-in date in YYYY-MM-DD format (e.g., '2025-12-29')"),
    checkout: z.string().describe("Check-out date in YYYY-MM-DD format (e.g., '2025-12-30')"),
    rooms: z.number().describe("Number of rooms (e.g., 1)"),
    adults: z.number().describe("Number of adults (e.g., 2)"),
    children: z.number().describe("Number of children (e.g., 0)"),
    name: z.string().describe("Hotel or location name (e.g., 'London')")
  },
  async (args) => {
    const { hotelId, checkin, checkout, rooms, adults, children, name } = args;

    const bookingUrl = `https://whitelabel.nuitee.link/hotels/${hotelId}?checkin=${checkin}&checkout=${checkout}&rooms=${rooms}&adults=${adults}&children=${children}&name=${encodeURIComponent(name)}`;

    return {
      content: [{
        type: "text",
        text: `Booking URL generated: ${bookingUrl}\n\nTo complete the booking, please open this URL in your browser.`
      }]
    };
  }
);

const transport = new StdioServerTransport();

server.connect(transport);
