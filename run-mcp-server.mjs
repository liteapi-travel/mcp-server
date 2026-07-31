#!/usr/bin/env node

/**
 * Wrapper script to run the MCP server
 * This ensures Node.js finds package.json and recognizes ES modules
 * Use this in Claude Desktop config instead of dist/index.js
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Import from dist - this will work because we're in the project root
const { LiteAPIMCPServer } = await import('./dist/index.js');

async function main() {
  try {
    const server = new LiteAPIMCPServer();
    await server.run();
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

main();
