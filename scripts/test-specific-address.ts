import axios from 'axios';

async function testSpecificAddress() {
    console.log('🧪 Testing Specific Address Balance Query');
    console.log('🎯 Address: 0xe652D940475aCD9B16628CB386722224f49d0B9F');

    try {
        // Wait for server to be ready
        await new Promise(resolve => setTimeout(resolve, 3000));

        const testAddress = '0xe652D940475aCD9B16628CB386722224f49d0B9F';

        // Test the actual chat endpoint
        const response = await axios.post('http://localhost:3000/api/chat', {
            message: `check the eth balance of ${testAddress}`,
            sessionId: 'test-specific-address-' + Date.now(),
            personality: 'Alice'
        }, {
            timeout: 60000
        });

        console.log('✅ Chat Response Status:', response.status);
        console.log('📝 Full Response:', response.data.response);

        if (response.data.toolResults && response.data.toolResults.length > 0) {
            console.log('🔧 Tool Results:');
            response.data.toolResults.forEach((result: any, index: number) => {
                console.log(`  ${index + 1}. ${result.name}:`);
                console.log(`     - Args: ${JSON.stringify(result.arguments)}`);
                console.log(`     - Success: ${result.success}`);
                if (result.success) {
                    try {
                        const resultContent = typeof result.result === 'string' ? JSON.parse(result.result) : result.result;
                        console.log(`     - Result: ${JSON.stringify(resultContent, null, 2)}`);
                    } catch {
                        console.log(`     - Result: ${result.result}`);
                    }
                } else {
                    console.log(`     - Error: ${result.error}`);
                }
            });
        } else {
            console.log('❌ No tool results found!');
        }

        // Check if the response contains the problem
        if (response.data.response && response.data.response.includes('NaN ETH')) {
            console.log('❌ PROBLEM: Still getting NaN ETH');

            // Let's test the MCP tool directly
            console.log('\n🔧 Testing MCP tool directly...');
            try {
                const mcpResponse = await axios.post('http://localhost:3000/api/mcp/call-tool', {
                    toolName: 'getBalance',
                    arguments: { address: testAddress }
                });

                console.log('📊 Direct MCP Response:', mcpResponse.data);
            } catch (mcpError) {
                console.log('❌ Direct MCP call failed:', mcpError.response?.data || mcpError.message);
            }

        } else {
            console.log('✅ SUCCESS: Got proper balance response');
        }

    } catch (error) {
        console.error('❌ Test failed:', error.response?.data || error.message);
    }
}

testSpecificAddress().catch(console.error);
