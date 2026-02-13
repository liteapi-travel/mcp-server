#!/usr/bin/env node

/**
 * Simple test script for LiteAPI MCP Server
 * 
 * Usage:
 *   export LITEAPI_API_KEY=your_api_key_here
 *   node test-server.js
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function testServer() {
  console.log('🚀 Testing LiteAPI MCP Server...\n');

  if (!process.env.LITEAPI_API_KEY) {
    console.error('❌ Error: LITEAPI_API_KEY environment variable not set');
    console.error('   Please run: export LITEAPI_API_KEY=your_api_key_here');
    process.exit(1);
  }

  const serverPath = join(__dirname, 'dist', 'index.js');
  console.log(`📁 Server path: ${serverPath}\n`);

  const transport = new StdioClientTransport({
    command: 'node',
    args: [serverPath],
    env: { 
      LITEAPI_API_KEY: process.env.LITEAPI_API_KEY 
    }
  });

  const client = new Client({
    name: 'test-client',
    version: '1.0.0'
  }, {
    capabilities: {}
  });

  try {
    console.log('🔌 Connecting to server...');
    await client.connect(transport);
    console.log('✅ Connected successfully!\n');

    // List all tools
    console.log('📋 Fetching available tools...');
    const tools = await client.listTools();
    console.log(`✅ Found ${tools.tools.length} tools\n`);
    
    // Show first 10 tools
    console.log('📝 Sample tools:');
    tools.tools.slice(0, 10).forEach((tool, index) => {
      const desc = tool.description?.substring(0, 60) || 'No description';
      console.log(`   ${index + 1}. ${tool.name}`);
      console.log(`      ${desc}${desc.length >= 60 ? '...' : ''}`);
    });
    
    if (tools.tools.length > 10) {
      console.log(`   ... and ${tools.tools.length - 10} more tools\n`);
    } else {
      console.log();
    }

    // Try to find a search tool
    const searchTool = tools.tools.find(t => 
      t.name.includes('hotels_rates') || 
      t.name.includes('search') ||
      t.name.includes('rates')
    );

    if (searchTool) {
      console.log(`🧪 Testing tool: ${searchTool.name}`);
      console.log(`   Description: ${searchTool.description?.substring(0, 80)}...\n`);
      
      // Note: We won't actually call it to avoid making real API calls in tests
      // But you can uncomment this to test:
      /*
      const result = await client.callTool({
        name: searchTool.name,
        arguments: {
          checkin: '2026-07-01',
          checkout: '2026-07-03',
          currency: 'USD',
          guestNationality: 'US',
          occupancies: [{ adults: 2 }],
          hotelIds: ['lp1897']
        }
      });
      console.log('✅ Tool call successful!');
      console.log('Response:', JSON.stringify(result, null, 2));
      */
      console.log('   (Skipping actual API call - uncomment in script to test)');
    }

    await client.close();
    console.log('\n✅ Test completed successfully!');
    console.log('\n💡 Next steps:');
    console.log('   1. Use MCP Inspector: npx @modelcontextprotocol/inspector node dist/index.js');
    console.log('   2. Connect to Claude Desktop (see README.md)');
    
  } catch (error) {
    console.error('\n❌ Error during test:');
    console.error(error);
    process.exit(1);
  }
}

testServer();
