# LiteAPI MCP Server

## Run just the server for development

```
npm run dev
```

## Run server and inspector

```
npm run inspect
```

---

## Configure with Claude

```json
{
  "mcpServers": {
    "liteapi": {
      "command": "/Users/YOUR_USER/.nvm/versions/node/v18.18.2/bin/node",
      "cwd": "/Users/YOUR_USER/mcp-server",
      "args": [
        "/Users/YOUR_USER/mcp-server/dist/index.js"
      ]
    }
  }
}
```