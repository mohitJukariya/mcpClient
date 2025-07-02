import * as dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

async function testImprovedEmbeddings() {
    console.log('🚀 Testing Improved Embedding Performance');
    console.log('='.repeat(60));
    console.log(`🔗 Base URL: ${BASE_URL}`);
    console.log('='.repeat(60));

    try {
        // Test 1: Check system health
        console.log('\n1️⃣ Testing System Health');
        console.log('-'.repeat(40));

        const healthResponse = await axios.get(`${BASE_URL}/api/context/health`);
        console.log('✅ System Health:', JSON.stringify(healthResponse.data, null, 2));

        // Test 2: Test embedding health
        console.log('\n2️⃣ Testing Embedding Health');
        console.log('-'.repeat(40));

        const embeddingHealthResponse = await axios.get(`${BASE_URL}/api/context/health/embeddings`);
        console.log('✅ Embedding Health:', JSON.stringify(embeddingHealthResponse.data, null, 2));

        // Test 3: Test embedding generation performance
        console.log('\n3️⃣ Testing Embedding Generation Performance');
        console.log('-'.repeat(40));

        const testTexts = [
            "What is the current ETH balance of address 0x123?",
            "Show me recent transactions for this address",
            "Analyze the trading patterns for this token",
            "Get the latest block information from Arbitrum",
            "What are the gas fees for transactions today?"
        ];

        for (let i = 0; i < testTexts.length; i++) {
            const text = testTexts[i];
            console.log(`\n   Test ${i + 1}/5: "${text.substring(0, 50)}..."`);

            try {
                const startTime = Date.now();
                const response = await axios.post(`${BASE_URL}/api/context/health/embeddings/test`,
                    { text },
                    { timeout: 45000 }
                );
                const totalTime = Date.now() - startTime;

                if (response.data.success) {
                    console.log(`   ✅ Success in ${totalTime}ms`);
                    console.log(`   📏 Dimension: ${response.data.dimension}`);
                    console.log(`   🎯 Performance: ${response.data.performance}`);
                    console.log(`   ⚡ Embedding time: ${response.data.duration}ms`);
                } else {
                    console.log(`   ❌ Failed: ${response.data.error}`);
                }
            } catch (error) {
                console.log(`   ❌ Request failed: ${error.message}`);
            }
        }

        // Test 4: Test rapid-fire embeddings (cache performance)
        console.log('\n4️⃣ Testing Cache Performance (Rapid-fire)');
        console.log('-'.repeat(40));

        const repeatedText = "This is a test for caching performance";
        const rapidTests = 3;

        for (let i = 0; i < rapidTests; i++) {
            console.log(`\n   Rapid test ${i + 1}/${rapidTests}:`);

            try {
                const startTime = Date.now();
                const response = await axios.post(`${BASE_URL}/api/context/health/embeddings/test`,
                    { text: repeatedText },
                    { timeout: 15000 }
                );
                const totalTime = Date.now() - startTime;

                if (response.data.success) {
                    console.log(`   ✅ Success in ${totalTime}ms (embedding: ${response.data.duration}ms)`);
                    if (i > 0 && response.data.duration < 100) {
                        console.log(`   📋 Cache hit detected! (very fast response)`);
                    }
                } else {
                    console.log(`   ❌ Failed: ${response.data.error}`);
                }
            } catch (error) {
                console.log(`   ❌ Request failed: ${error.message}`);
            }
        }

        // Test 5: Test context storage with embeddings
        console.log('\n5️⃣ Testing Context Storage with Embeddings');
        console.log('-'.repeat(40));

        const contextData = {
            query: "What's the ETH balance of 0x742E8BdD2ce80A4422E880164f2079488e115365?",
            toolsUsed: ["arbitrum-balance-checker"],
            addressesInvolved: ["0x742E8BdD2ce80A4422E880164f2079488e115365"],
            insights: [
                { content: "User is checking balance of a specific address", confidence: 0.9 }
            ],
            metadata: {
                sessionId: `test-session-${Date.now()}`,
                confidence: 0.95,
                personality: "analyst"
            }
        };

        try {
            const startTime = Date.now();
            const response = await axios.post(
                `${BASE_URL}/api/context/users/test-user-embedding/context`,
                contextData,
                { timeout: 30000 }
            );
            const totalTime = Date.now() - startTime;

            if (response.data.success) {
                console.log(`   ✅ Context stored successfully in ${totalTime}ms`);
                console.log(`   📝 Context ID: ${response.data.contextId}`);
                console.log(`   📊 Storage status:`, response.data.stored);
            } else {
                console.log(`   ❌ Context storage failed: ${response.data.message}`);
            }
        } catch (error) {
            console.log(`   ❌ Context storage request failed: ${error.message}`);
        }

        console.log('\n' + '='.repeat(60));
        console.log('🏁 Improved Embedding Test Complete!');
        console.log('📈 Performance Summary:');
        console.log('  - System should show warm-up improvements');
        console.log('  - Cache should speed up repeated queries');
        console.log('  - Multiple models provide reliable fallbacks');
        console.log('  - Better error handling and retries');

    } catch (error) {
        console.error('❌ Test suite failed:', error.message);
    }
}

// Run the test
testImprovedEmbeddings().catch(console.error);
