/**
 * Test MCP HTTP/SSE endpoint locally
 * Run: LITEAPI_API_KEY=sand_xxx npx tsx scripts/test-mcp-http.ts
 * Then: curl "http://localhost:3001/mcp?apiKey=sand_xxx"
 */
import { createServer, IncomingMessage, ServerResponse } from 'http';
import mcpHandler from '../api/mcp.js';

const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  if (req.url?.startsWith('/mcp')) {
    const url = new URL(req.url || '', `http://localhost:3001`);
    
    const vercelReq = {
      method: req.method,
      url: req.url,
      query: Object.fromEntries(url.searchParams),
      headers: req.headers,
    };
    
    const vercelRes = {
      setHeader: (k: string, v: string) => res.setHeader(k, v),
      getHeader: (k: string) => res.getHeader(k),
      writeHead: (...args: any[]) => res.writeHead(...args),
      write: (chunk: any) => res.write(chunk),
      end: (data?: any) => res.end(data),
      on: (ev: string, fn: (...args: any[]) => void) => res.on(ev, fn),
      status: (code: number) => {
        res.statusCode = code;
        return vercelRes;
      },
      json: (data: any) => {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(data));
      },
      headersSent: false,
    };
    
    Object.defineProperty(vercelRes, 'headersSent', {
      get: () => res.headersSent,
    });
    
    await mcpHandler(vercelReq as any, vercelRes as any);
  } else {
    res.writeHead(404).end('Not found');
  }
});

const PORT = 3001;
server.listen(PORT, () => {
  console.log(`MCP test server: http://localhost:${PORT}/mcp`);
  console.log(`Test: curl "http://localhost:${PORT}/mcp?apiKey=YOUR_KEY"`);
});
