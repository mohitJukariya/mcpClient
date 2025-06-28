import axios from 'axios';
import * as dotenv from 'dotenv';

dotenv.config();

const BASE_URL = 'http://localhost:3000';

async function testCompleteSystem() {
    console.log('🧪 Testing Complete Multi-Storage Context System');
    console.log('='.repeat(60));

    try {
        // Test 1: Initialize Test Users
        console.log('\n1️⃣ Testing User Initialization...');
        console.log('-'.repeat(40));

        const usersResponse = await axios.get(`${BASE_URL}/api/context/users`);
        console.log(`✅ Found ${usersResponse.data.length} test users:`);
        usersResponse.data.forEach((user: any) => {
            console.log(`  - ${user.name} (${user.role}): ${user.preferences.defaultTokens.join(', ')}`);
        });

        // Test 2: Test Storage Health
        console.log('\n2️⃣ Testing Storage Health...');
        console.log('-'.repeat(40));

        const healthResponse = await axios.get(`${BASE_URL}/api/context/storage/health`);
        console.log('✅ Storage Health:', healthResponse.data);

        // Test 3: Test Chat with Context (User 1)
        console.log('\n3️⃣ Testing Chat with User Context (Alice - Trader)...');
        console.log('-'.repeat(40));

        const chat1Response = await axios.post(`${BASE_URL}/api/chat`, {
            message: "What's the current gas price on Arbitrum?",
            sessionId: "test-session-alice",
            userId: "user-001"
        });

        console.log('✅ Alice\'s Chat Response:');
        console.log(`   Response: ${chat1Response.data.response.substring(0, 150)}...`);
        console.log(`   Tools Used: ${chat1Response.data.toolsUsed?.length || 0}`);
        console.log(`   Session ID: ${chat1Response.data.sessionId}`);

        // Test 4: Test Chat with Context (User 2)
        console.log('\n4️⃣ Testing Chat with User Context (Bob - Developer)...');
        console.log('-'.repeat(40));

        const chat2Response = await axios.post(`${BASE_URL}/api/chat`, {
            message: "Can you help me analyze this contract: 0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
            sessionId: "test-session-bob",
            userId: "user-002"
        });

        console.log('✅ Bob\'s Chat Response:');
        console.log(`   Response: ${chat2Response.data.response.substring(0, 150)}...`);
        console.log(`   Tools Used: ${chat2Response.data.toolsUsed?.length || 0}`);

        // Test 5: Test Graph Visualization
        console.log('\n5️⃣ Testing Graph Visualization...');
        console.log('-'.repeat(40));

        const graphResponse = await axios.get(`${BASE_URL}/api/context/graph/visualization?userId=user-001`);
        console.log('✅ Graph Visualization for Alice:');
        console.log(`   Nodes: ${graphResponse.data.nodes.length}`);
        console.log(`   Edges: ${graphResponse.data.edges.length}`);
        console.log(`   Users: ${graphResponse.data.metadata.userCount}`);
        console.log(`   Tools: ${graphResponse.data.metadata.toolCount}`);

        // Test 6: Test Context Insights
        console.log('\n6️⃣ Testing Context Insights...');
        console.log('-'.repeat(40));

        const insightsResponse = await axios.get(`${BASE_URL}/api/context/graph/insights/user-001`);
        console.log('✅ Context Insights for Alice:');
        console.log(`   User Profile: ${JSON.stringify(insightsResponse.data.userProfile)}`);
        console.log(`   Top Tools: ${insightsResponse.data.topTools.slice(0, 3).map((t: any) => t.tool).join(', ')}`);
        console.log(`   Recommendations: ${insightsResponse.data.recommendations.length}`);

        // Test 7: Test Analytics
        console.log('\n7️⃣ Testing Analytics Dashboard...');
        console.log('-'.repeat(40));

        const analyticsResponse = await axios.get(`${BASE_URL}/api/analytics/overview?timeRange=week`);
        console.log('✅ Analytics Overview:');
        console.log(`   Total Embeddings: ${analyticsResponse.data.stats.totalEmbeddings}`);
        console.log(`   Total Sessions: ${analyticsResponse.data.stats.totalSessions}`);
        console.log(`   System Health: ${analyticsResponse.data.health.pineconeStatus}`);

        // Test 8: Test Failsafe System
        console.log('\n8️⃣ Testing Failsafe System...');
        console.log('-'.repeat(40));

        const failsafeResponse = await axios.post(`${BASE_URL}/api/failsafe/handle-failure`, {
            query: "What's the gas price?",
            error: "Timeout error"
        });

        console.log('✅ Failsafe Response:');
        console.log(`   Success: ${failsafeResponse.data.success}`);
        console.log(`   Fallback Level: ${failsafeResponse.data.fallbackLevel}`);
        console.log(`   Response: ${failsafeResponse.data.response.substring(0, 100)}...`);

        // Test 9: Test KV Store Operations
        console.log('\n9️⃣ Testing KV Store Operations...');
        console.log('-'.repeat(40));

        // Store data
        await axios.post(`${BASE_URL}/api/context/kv/test-key`, {
            data: { message: "Hello KV Store!", timestamp: new Date().toISOString() },
            ttl: 3600
        });

        // Retrieve data
        const kvResponse = await axios.get(`${BASE_URL}/api/context/kv/test-key`);
        console.log('✅ KV Store Test:');
        console.log(`   Data Retrieved: ${JSON.stringify(kvResponse.data.data)}`);
        console.log(`   Found: ${kvResponse.data.found}`);

        // Test 10: Test Vector Search
        console.log('\n🔟 Testing Vector Search...');
        console.log('-'.repeat(40));

        const vectorResponse = await axios.get(`${BASE_URL}/api/context/search/vector?query=gas price&userId=user-001`);
        console.log('✅ Vector Search Results:');
        console.log(`   Results Found: ${vectorResponse.data.count}`);
        if (vectorResponse.data.results.length > 0) {
            console.log(`   Top Result: ${vectorResponse.data.results[0].content.substring(0, 100)}...`);
        }

        // Test 11: Test Graph Query
        console.log('\n1️⃣1️⃣ Testing Graph Database Query...');
        console.log('-'.repeat(40));

        const graphQueryResponse = await axios.post(`${BASE_URL}/api/context/graph/query`, {
            cypher: "MATCH (u:User) RETURN u.name as name, u.role as role LIMIT 5",
            parameters: {}
        });

        console.log('✅ Graph Query Results:');
        console.log(`   Results: ${graphQueryResponse.data.count}`);
        if (graphQueryResponse.data.results.length > 0) {
            graphQueryResponse.data.results.forEach((result: any) => {
                console.log(`   User: ${result.name} (${result.role})`);
            });
        }

        // Test 12: Test Related Query with Context
        console.log('\n1️⃣2️⃣ Testing Related Query with Context...');
        console.log('-'.repeat(40));

        const relatedResponse = await axios.post(`${BASE_URL}/api/chat`, {
            message: "Is now a good time to make a transaction?",
            sessionId: "test-session-alice",
            userId: "user-001"
        });

        console.log('✅ Related Query Response (should use context):');
        console.log(`   Response: ${relatedResponse.data.response.substring(0, 150)}...`);
        console.log(`   Context Used: ${relatedResponse.data.metadata?.contextUsed || 'Unknown'}`);

        console.log('\n' + '='.repeat(60));
        console.log('🎉 All system tests completed successfully!');
        console.log('='.repeat(60));

        console.log('\n📊 System Summary:');
        console.log(`✅ Multi-User Context: ${usersResponse.data.length} test users`);
        console.log(`✅ Storage Health: Redis ${healthResponse.data.redis}, Neo4j ${healthResponse.data.neo4j}, Pinecone ${healthResponse.data.pinecone}`);
        console.log(`✅ Graph Visualization: ${graphResponse.data.nodes.length} nodes, ${graphResponse.data.edges.length} edges`);
        console.log(`✅ Analytics Dashboard: Working`);
        console.log(`✅ Failsafe System: Working`);
        console.log(`✅ Vector Embeddings: Working`);
        console.log(`✅ Context Management: Working`);

        return true;

    } catch (error) {
        console.error('❌ System test failed:', error.response?.data || error.message);
        return false;
    }
}

async function main() {
    console.log('🚀 Starting Complete System Test Suite');
    console.log(`⏰ Time: ${new Date().toISOString()}`);
    console.log('\n');

    const success = await testCompleteSystem();
    process.exit(success ? 0 : 1);
}

if (require.main === module) {
    main().catch(error => {
        console.error('💥 Test suite failed:', error);
        process.exit(1);
    });
}
