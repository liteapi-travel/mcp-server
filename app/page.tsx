export default function Home() {
  return (
    <main style={{ padding: '2rem', fontFamily: 'system-ui', maxWidth: '800px', margin: '0 auto' }}>
      <h1>LiteAPI MCP Server</h1>
      <p>MCP endpoint: <a href="/api/mcp">/api/mcp</a></p>
      <p><strong>ChatGPT:</strong> Add this URL with your API key:</p>
      <pre style={{ background: '#f5f5f5', padding: '1rem', borderRadius: '4px', overflow: 'auto' }}>
        https://mcp.liteapi.travel/api/mcp?apiKey=YOUR_LITEAPI_KEY
      </pre>
      <p>Or set <code>LITEAPI_API_KEY</code> in Vercel for single-tenant deployment.</p>
    </main>
  );
}
