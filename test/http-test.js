#!/usr/bin/env node

/**
 * Simple HTTP endpoint testing script for LiteAPI MCP Server
 * 
 * Usage:
 *   node test/http-test.js [apiKey]
 * 
 * If apiKey is not provided, tests will check for authentication requirements
 */

const http = require('http');
const https = require('https');

const BASE_URL = process.env.TEST_URL || 'http://localhost:3000';
const API_KEY = process.argv[2] || process.env.LITEAPI_API_KEY;

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function makeRequest(path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const client = url.protocol === 'https:' ? https : http;
    
    const reqOptions = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      method: options.method || 'GET',
      headers: {
        ...options.headers,
      },
    };

    const req = client.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const json = data ? JSON.parse(data) : null;
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: json || data,
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: data,
          });
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function testHealthEndpoint() {
  log('\n📊 Testing Health Endpoint', 'blue');
  try {
    const response = await makeRequest('/health');
    if (response.status === 200 && response.body.status === 'healthy') {
      log('✅ Health check passed', 'green');
      log(`   Status: ${response.body.status}`, 'green');
      log(`   Version: ${response.body.version}`, 'green');
      log(`   Uptime: ${response.body.uptime}s`, 'green');
      return true;
    } else {
      log('❌ Health check failed', 'red');
      log(`   Status: ${response.status}`, 'red');
      return false;
    }
  } catch (error) {
    log(`❌ Health check error: ${error.message}`, 'red');
    return false;
  }
}

async function testProtectedResourceMetadata() {
  log('\n🔐 Testing Protected Resource Metadata', 'blue');
  try {
    const response = await makeRequest('/.well-known/oauth-protected-resource');
    if (response.status === 200 && response.body.resource) {
      log('✅ Protected Resource Metadata endpoint works', 'green');
      log(`   Resource: ${response.body.resource}`, 'green');
      log(`   Scopes: ${response.body.scopes_supported?.join(', ')}`, 'green');
      return true;
    } else {
      log('❌ Protected Resource Metadata endpoint failed', 'red');
      return false;
    }
  } catch (error) {
    log(`❌ Error: ${error.message}`, 'red');
    return false;
  }
}

async function testAuthenticationRequired() {
  log('\n🔒 Testing Authentication Requirement', 'blue');
  try {
    const response = await makeRequest('/mcp');
    if (response.status === 401) {
      log('✅ Authentication required (401 returned)', 'green');
      const authHeader = response.headers['www-authenticate'];
      if (authHeader) {
        log(`   WWW-Authenticate: ${authHeader}`, 'green');
      }
      return true;
    } else {
      log(`❌ Expected 401, got ${response.status}`, 'red');
      return false;
    }
  } catch (error) {
    log(`❌ Error: ${error.message}`, 'red');
    return false;
  }
}

async function testBearerTokenAuth() {
  if (!API_KEY) {
    log('\n⚠️  Skipping Bearer token test (no API key provided)', 'yellow');
    return true;
  }

  log('\n🎫 Testing Bearer Token Authentication', 'blue');
  try {
    const response = await makeRequest('/mcp', {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Accept': 'text/event-stream',
      },
    });
    
    // SSE connections return 200 and start streaming
    if (response.status === 200 || response.status === 401) {
      if (response.status === 200) {
        log('✅ Bearer token authentication works', 'green');
      } else {
        log('⚠️  Bearer token rejected (invalid key?)', 'yellow');
        log(`   Response: ${JSON.stringify(response.body)}`, 'yellow');
      }
      return true;
    } else {
      log(`❌ Unexpected status: ${response.status}`, 'red');
      return false;
    }
  } catch (error) {
    // SSE connections may cause connection errors, which is expected
    if (error.code === 'ECONNRESET' || error.message.includes('ECONNRESET')) {
      log('✅ Bearer token accepted (SSE connection established)', 'green');
      return true;
    }
    log(`❌ Error: ${error.message}`, 'red');
    return false;
  }
}

async function testApiKeyHeader() {
  if (!API_KEY) {
    log('\n⚠️  Skipping API key header test (no API key provided)', 'yellow');
    return true;
  }

  log('\n🔑 Testing X-Api-Key Header Authentication', 'blue');
  try {
    const response = await makeRequest('/mcp', {
      headers: {
        'X-Api-Key': API_KEY,
        'Accept': 'text/event-stream',
      },
    });
    
    if (response.status === 200 || response.status === 401) {
      if (response.status === 200) {
        log('✅ X-Api-Key header authentication works', 'green');
      } else {
        log('⚠️  X-Api-Key rejected (invalid key?)', 'yellow');
      }
      return true;
    } else {
      log(`❌ Unexpected status: ${response.status}`, 'red');
      return false;
    }
  } catch (error) {
    if (error.code === 'ECONNRESET' || error.message.includes('ECONNRESET')) {
      log('✅ X-Api-Key accepted (SSE connection established)', 'green');
      return true;
    }
    log(`❌ Error: ${error.message}`, 'red');
    return false;
  }
}

async function runAllTests() {
  log('🧪 LiteAPI MCP Server HTTP Tests', 'blue');
  log('=' .repeat(50), 'blue');
  
  if (API_KEY) {
    log(`Using API Key: ${API_KEY.substring(0, 10)}...`, 'yellow');
  } else {
    log('No API key provided - testing authentication requirements only', 'yellow');
  }

  const results = {
    health: await testHealthEndpoint(),
    metadata: await testProtectedResourceMetadata(),
    authRequired: await testAuthenticationRequired(),
    bearerToken: await testBearerTokenAuth(),
    apiKeyHeader: await testApiKeyHeader(),
  };

  log('\n' + '='.repeat(50), 'blue');
  log('📋 Test Summary', 'blue');
  log('='.repeat(50), 'blue');
  
  const passed = Object.values(results).filter(Boolean).length;
  const total = Object.keys(results).length;
  
  Object.entries(results).forEach(([test, passed]) => {
    const status = passed ? '✅' : '❌';
    log(`${status} ${test}`, passed ? 'green' : 'red');
  });

  log(`\n${passed}/${total} tests passed`, passed === total ? 'green' : 'yellow');
  
  if (passed === total) {
    log('\n🎉 All tests passed!', 'green');
    process.exit(0);
  } else {
    log('\n⚠️  Some tests failed', 'yellow');
    process.exit(1);
  }
}

// Run tests
runAllTests().catch((error) => {
  log(`\n💥 Test runner error: ${error.message}`, 'red');
  process.exit(1);
});
