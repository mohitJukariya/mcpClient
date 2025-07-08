import axios from 'axios';

async function testMultipleAddressScenarios() {
    console.log('🧪 Testing Multiple Address Scenarios');

    const addresses = [
        '0xe652D940475aCD9B16628CB386722224f49d0B9F',
        '0x5616CAABa92cdf656E7d1bA36Fe1bd878E51c174',
        '0xC7d62e8dfD78d2270382414d6c7323F6c54542c6'
    ];

    try {
        // Wait for server to be ready
        await new Promise(resolve => setTimeout(resolve, 2000));

        for (let i = 0; i < addresses.length; i++) {
            const address = addresses[i];
            const sessionId = `test-multi-${i}-${Date.now()}`;

            console.log(`\n🎯 Testing address ${i + 1}: ${address}`);
            console.log(`📋 Session ID: ${sessionId}`);

            try {
                const response = await axios.post('http://localhost:3000/api/chat', {
                    message: `What is the ETH balance of ${address}?`,
                    sessionId: sessionId,
                    personality: 'Alice'
                }, {
                    timeout: 30000
                });

                console.log(`✅ Status: ${response.status}`);
                console.log(`📝 Response: ${response.data.response}`);

                // Check for problems
                if (response.data.response.includes('NaN ETH')) {
                    console.log('❌ PROBLEM: NaN ETH detected');

                    // Check if there are tool results
                    if (response.data.toolResults && response.data.toolResults.length > 0) {
                        console.log('🔧 Tool Results Available:');
                        response.data.toolResults.forEach((result: any, idx: number) => {
                            console.log(`  ${idx + 1}. ${result.name}: success=${result.success}`);
                            if (!result.success) {
                                console.log(`     Error: ${result.error}`);
                            }
                        });
                    } else {
                        console.log('❌ No tool results found');
                    }
                } else if (response.data.response.includes('ETH')) {
                    console.log('✅ SUCCESS: Got valid ETH balance');
                } else {
                    console.log('⚠️  UNKNOWN: Response doesn\'t contain ETH info');
                }

                // Small delay between requests
                await new Promise(resolve => setTimeout(resolve, 1000));

            } catch (error) {
                console.log(`❌ Error for ${address}:`, error.response?.data || error.message);
            }
        }

        // Test with cached conversation (multiple queries in same session)
        console.log('\n🔄 Testing cached conversation scenario...');
        const cachedSessionId = `test-cached-${Date.now()}`;

        try {
            // First query
            const firstResponse = await axios.post('http://localhost:3000/api/chat', {
                message: `Get balance of ${addresses[0]}`,
                sessionId: cachedSessionId,
                personality: 'Alice'
            });

            console.log('📝 First query response:', firstResponse.data.response);

            // Second query in same session
            await new Promise(resolve => setTimeout(resolve, 1000));
            const secondResponse = await axios.post('http://localhost:3000/api/chat', {
                message: `Now check ${addresses[1]}`,
                sessionId: cachedSessionId,
                personality: 'Alice'
            });

            console.log('📝 Second query response:', secondResponse.data.response);

            if (secondResponse.data.response.includes('NaN ETH')) {
                console.log('❌ PROBLEM: NaN ETH in cached conversation');
            } else {
                console.log('✅ Cached conversation working correctly');
            }

        } catch (error) {
            console.log('❌ Cached conversation test failed:', error.response?.data || error.message);
        }

    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

testMultipleAddressScenarios().catch(console.error);
