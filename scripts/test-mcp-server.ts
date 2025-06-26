import axios from 'axios';

const MCP_SERVER_URL = 'https://arbitrummcpserver-production.up.railway.app/api/mcp';

async function testMCPServer() {
    console.log('🔧 Testing MCP Server Connection...');
    console.log(`📍 Server URL: ${MCP_SERVER_URL}`);

    try {
        // Test initialization
        console.log('\n1️⃣ Testing initialization...');
        const initResponse = await axios.post(MCP_SERVER_URL, {
            jsonrpc: '2.0',
            id: 'test-init',
            method: 'initialize',
        });
        console.log('✅ Initialization successful:', initResponse.data.result);

        // Test listing tools
        console.log('\n2️⃣ Testing tools list...');
        const toolsResponse = await axios.post(MCP_SERVER_URL, {
            jsonrpc: '2.0',
            id: 'test-tools',
            method: 'tools/list',
        });

        const tools = toolsResponse.data.result?.tools || [];
        console.log(`✅ Found ${tools.length} tools:`);
        tools.forEach((tool: any, index: number) => {
            console.log(`   ${index + 1}. ${tool.name} - ${tool.description}`);
        });

        // Test ping
        console.log('\n3️⃣ Testing ping...');
        const pingResponse = await axios.post(MCP_SERVER_URL, {
            jsonrpc: '2.0',
            id: 'test-ping',
            method: 'ping',
        });
        console.log('✅ Ping successful:', pingResponse.data.result);

        console.log('\n🎉 All tests passed! MCP Server is working correctly.');
        return true;

    } catch (error: any) {
        console.error('❌ Test failed:', error.message);
        if (error.response?.data) {
            console.error('📄 Response data:', error.response.data);
        }
        return false;
    }
}

// Run the test
testMCPServer()
    .then((success) => {
        process.exit(success ? 0 : 1);
    })
    .catch((error) => {
        console.error('💥 Unexpected error:', error);
        process.exit(1);
    });
