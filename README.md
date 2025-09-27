# LiteAPI MCP Server

A Model Context Protocol (MCP) server that provides access to LiteAPI hotel booking services. This server can be used with AI assistants like Claude or integrated into n8n workflows for automation.

## Features

- **Hotel Search**: Find hotels by location, dates, and preferences
- **Booking Management**: Create, modify, and cancel hotel bookings
- **Analytics**: Access booking analytics and reports
- **Loyalty Programs**: Manage loyalty points and rewards
- **Voucher System**: Handle discount vouchers and promotions
- **Static Data**: Access hotel, city, and country information

## Installation

```bash
npm install -g liteapi-mcp-server
```

## Configuration

Set your LiteAPI API key as an environment variable:

```bash
export LITEAPI_API_KEY="your_api_key_here"
```

## Usage

### As a Standalone MCP Server

```bash
liteapi-mcp-server
```

### With MCP Inspector (Development)

```bash
npm run inspect
```

## n8n Integration

This MCP server can be used with n8n workflows using existing MCP integration packages.

### Option 1: Using @coleam/n8n-nodes-mcp

1. Install the n8n MCP node:
```bash
npm install @coleam/n8n-nodes-mcp
```

2. Configure your n8n workflow to connect to the MCP server:
   - Add the MCP node to your workflow
   - Set the server command to: `liteapi-mcp-server`
   - Set the working directory to where the package is installed
   - Configure environment variables for your API key

### Option 2: Using @mseep/n8n-nodes-mcp

1. Install the n8n MCP node:
```bash
npm install @mseep/n8n-nodes-mcp
```

2. Follow the package documentation for configuration

### n8n Workflow Example

```json
{
  "nodes": [
    {
      "name": "MCP LiteAPI Search",
      "type": "@coleam/n8n-nodes-mcp.mcp",
      "parameters": {
        "serverCommand": "liteapi-mcp-server",
        "toolName": "search-hotels",
        "toolArguments": {
          "checkin": "2024-01-15",
          "checkout": "2024-01-20",
          "guests": 2,
          "rooms": 1,
          "location": "New York"
        }
      }
    }
  ]
}
```

## Available Tools

The server provides tools for:

- **Hotel Search**: `search-hotels`, `search-hotels-by-geo`
- **Booking**: `create-booking`, `get-booking`, `cancel-booking`
- **Analytics**: `get-most-booked-hotels`, `get-booking-analytics`
- **Loyalty**: `get-loyalty-program`, `redeem-loyalty-points`
- **Vouchers**: `validate-voucher`, `apply-voucher`
- **Static Data**: `get-countries`, `get-cities`, `get-hotels`

## Development

### Run in Development Mode

```bash
npm run dev
```

### Build

```bash
npm run build
```

### Test with Inspector

```bash
npm run inspect
```

## Claude Desktop Integration

Add to your Claude Desktop configuration:

```json
{
  "mcpServers": {
    "liteapi": {
      "command": "liteapi-mcp-server",
      "env": {
        "LITEAPI_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

## API Key

Get your API key from [LiteAPI](https://liteapi.com/). Set it as the `LITEAPI_API_KEY` environment variable or it will default to the sandbox key for testing.

## License

MIT