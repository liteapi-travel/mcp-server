#!/usr/bin/env node

import { LiteAPIMCPServer } from './server.js';

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
