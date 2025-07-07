import axios from 'axios';

async function testEndToEndBalance() {
    console.log('🧪 Testing End-to-End Balance Query');

    try {
        // Wait for server to fully startup
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Test the actual chat endpoint
        const response = await axios.post('http://localhost:3000/api/chat', {
            message: 'fetch the eth balance of this address 0x5616CAABa92cdf656E7d1bA36Fe1bd878E51c174',
            sessionId: 'test-session-balance-' + Date.now(),
            personality: 'Alice'
        }, {
            timeout: 30000
        });

        console.log('✅ Chat Response:', {
            status: response.status,
            contentLength: response.data.response?.length || 0,
            hasToolResults: response.data.toolResults?.length > 0,
            toolResultsCount: response.data.toolResults?.length || 0
        });

        if (response.data.toolResults && response.data.toolResults.length > 0) {
            console.log('🔧 Tool Results:');
            response.data.toolResults.forEach((result: any, index: number) => {
                console.log(`  ${index + 1}. ${result.name}:`);
                console.log(`     - Args: ${JSON.stringify(result.arguments)}`);
                console.log(`     - Success: ${result.success}`);
                if (result.success) {
                    console.log(`     - Result: ${JSON.stringify(result.result, null, 2)}`);
                } else {
                    console.log(`     - Error: ${result.error}`);
                }
            });
        }

        console.log('📝 Full Response:', response.data.response);

        // Check if we got a proper balance response
        if (response.data.response && !response.data.response.includes('NaN ETH')) {
            console.log('✅ SUCCESS: Got proper balance response (no NaN ETH)');
        } else {
            console.log('❌ FAILURE: Still getting NaN ETH or no response');
        }

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        if (error.response) {
            console.error('Response data:', error.response.data);
        }
    }
}

testEndToEndBalance().catch(console.error);
