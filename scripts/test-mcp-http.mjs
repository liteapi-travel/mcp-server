#!/usr/bin/env node
/**
 * Test MCP HTTP/SSE endpoint locally
 * Run: LITEAPI_API_KEY=sand_xxx node scripts/test-mcp-http.mjs
 * Then: curl "http://localhost:3001/mcp?apiKey=sand_xxx"
 */
import { createServer } from 'http';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');

// Dynamic import of the compiled api/mcp handler
// We need to simulate the Vercel request/response
async function loadHandler() {
  const { default: handler } = await import('../api/mcp.ts');
  return handler;
}

const handler = await loadHandler();

const server = createServer(async (req, res) => {
  if (req.url?.startsWith('/mcp')) {
    const url = new URL(req.url || '', `http://localhost:3001`);
    const apiKey = url.searchParams.get('apiKey') || req.headers['x-api-key'];
    
    const vercelReq = {
      method: req.method,
      url: req.url,
      query: Object.fromEntries(url.searchParams),
      headers: req.headers,
    };
    
    const vercelRes = {
      setHeader: (k, v) => res.setHeader(k, v),
      getHeader: (k) => res.getHeader(k),
      writeHead: (...args) => res.writeHead(...args),
      write: (chunk) => res.write(chunk),
      end: (data) => res.end(data),
      on: (ev, fn) => res.on(ev, fn),
      status: (code) => { res.statusCode = code; return vercelRes; },
      json: (data) => {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(data));
      },
    };
    
    await handler(vercelReq, vercelRes);
  } else {
    res.writeHead(404).end('Not found');
  }
});

const PORT = 3001;
server.listen(PORT, () => {
  console.log(`MCP test server: http://localhost:${PORT}/mcp`);
  console.log(`Test: curl "http://localhost:${PORT}/mcp?apiKey=YOUR_KEY"`);
});
