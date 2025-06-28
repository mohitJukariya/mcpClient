import axios from 'axios';

async function testMcpEndpoint() {
    console.log('🧪 Testing MCP Server Endpoint');
    console.log('='.repeat(40));

    const mcpServerUrl = 'https://arbitrummcpserver-production.up.railway.app';

    // Test 1: Root endpoint
    console.log('\n1️⃣ Testing root endpoint...');
    try {
        const response = await axios.get(mcpServerUrl, { timeout: 5000 });
        console.log('✅ Root endpoint response:', response.status, response.statusText);
        console.log('   Content:', response.data?.substring?.(0, 100) || response.data);
    } catch (error: any) {
        console.log('❌ Root endpoint failed:', error.response?.status, error.message);
    }

    // Test 2: /api endpoint
    console.log('\n2️⃣ Testing /api endpoint...');
    try {
        const response = await axios.get(`${mcpServerUrl}/api`, { timeout: 5000 });
        console.log('✅ /api endpoint response:', response.status, response.statusText);
        console.log('   Content:', response.data?.substring?.(0, 100) || response.data);
    } catch (error: any) {
        console.log('❌ /api endpoint failed:', error.response?.status, error.message);
    }

    // Test 3: /api/mcp endpoint with POST (the actual MCP call)
    console.log('\n3️⃣ Testing /api/mcp endpoint with POST...');
    try {
        const mcpRequest = {
            jsonrpc: '2.0',
            id: 'test',
            method: 'initialize',
            params: {
                protocolVersion: '2024-11-05',
                capabilities: {},
                clientInfo: { name: 'test-client', version: '1.0.0' }
            }
        };

        const response = await axios.post(`${mcpServerUrl}/api/mcp`, mcpRequest, {
            timeout: 10000,
            headers: { 'Content-Type': 'application/json' }
        });
        console.log('✅ /api/mcp POST response:', response.status, response.statusText);
        console.log('   MCP Response:', JSON.stringify(response.data, null, 2));
    } catch (error: any) {
        console.log('❌ /api/mcp POST failed:', error.response?.status, error.response?.statusText);
        console.log('   Error data:', error.response?.data);
        console.log('   Error message:', error.message);
    }

    // Test 4: Try tools/list
    console.log('\n4️⃣ Testing tools/list endpoint...');
    try {
        const toolsRequest = {
            jsonrpc: '2.0',
            id: 'tools-test',
            method: 'tools/list',
            params: {}
        };

        const response = await axios.post(`${mcpServerUrl}/api/mcp`, toolsRequest, {
            timeout: 10000,
            headers: { 'Content-Type': 'application/json' }
        });
        console.log('✅ tools/list response:', response.status, response.statusText);
        console.log('   Tools:', JSON.stringify(response.data, null, 2));
    } catch (error: any) {
        console.log('❌ tools/list failed:', error.response?.status, error.response?.statusText);
        console.log('   Error data:', error.response?.data);
    }

    // Test 5: Check if it's a WebSocket-only server
    console.log('\n5️⃣ Checking server headers...');
    try {
        const response = await axios.head(mcpServerUrl, { timeout: 5000 });
        console.log('✅ Server headers:');
        Object.entries(response.headers).forEach(([key, value]) => {
            console.log(`   ${key}: ${value}`);
        });
    } catch (error: any) {
        console.log('❌ HEAD request failed:', error.message);
    }

    console.log('\n🔍 Analysis:');
    console.log('The MCP server might be:');
    console.log('1. Down or moved to a different URL');
    console.log('2. Expecting different HTTP methods or headers');
    console.log('3. Using WebSocket instead of HTTP');
    console.log('4. Requiring authentication');
    console.log('5. Behind a firewall or rate limiter');
}

testMcpEndpoint().catch(console.error);
