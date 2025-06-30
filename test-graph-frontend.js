// Test script to verify the new graph visualization frontend
const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:3000';

async function makeRequest(endpoint) {
    try {
        const response = await fetch(`${BASE_URL}${endpoint}`);
        const data = await response.json();
        return { status: response.status, data };
    } catch (error) {
        return { status: 'error', error: error.message };
    }
}

async function testGraphVisualization() {
    console.log('🧪 Testing Graph Visualization Endpoints...');
    
    // 1. Test context graph visualization
    console.log('\n1. 📊 Testing graph visualization endpoint...');
    try {
        const graphResponse = await makeRequest('/context/graph/visualization');
        console.log(`   Status: ${graphResponse.status}`);
        console.log(`   Nodes: ${graphResponse.data.nodes?.length || 0}`);
        console.log(`   Edges: ${graphResponse.data.edges?.length || 0}`);
        
        if (graphResponse.data.nodes?.length > 0) {
            console.log('   📋 Sample nodes:');
            graphResponse.data.nodes.slice(0, 3).forEach((node, i) => {
                console.log(`     ${i + 1}. ${node.type}: ${node.id} (${node.label})`);
            });
        }
    } catch (error) {
        console.log(`   ❌ Graph visualization error: ${error.message}`);
    }
    
    // 2. Test graph stats
    console.log('\n2. 📈 Testing graph stats endpoint...');
    try {
        const statsResponse = await makeRequest('/context/graph/stats');
        console.log(`   Status: ${statsResponse.status}`);
        console.log(`   Total Nodes: ${statsResponse.data.totalNodes || 0}`);
        console.log(`   Total Edges: ${statsResponse.data.totalEdges || 0}`);
        
        if (statsResponse.data.nodeTypes) {
            console.log('   📊 Node types:');
            Object.entries(statsResponse.data.nodeTypes).forEach(([type, count]) => {
                console.log(`     ${type}: ${count}`);
            });
        }
    } catch (error) {
        console.log(`   ❌ Graph stats error: ${error.message}`);
    }
    
    // 3. Test users endpoint
    console.log('\n3. 👥 Testing users endpoint...');
    try {
        const usersResponse = await makeRequest('/context/users');
        console.log(`   Status: ${usersResponse.status}`);
        console.log(`   Users: ${usersResponse.data?.length || 0}`);
        
        if (usersResponse.data?.length > 0) {
            console.log('   📋 Available users:');
            usersResponse.data.forEach((user, i) => {
                console.log(`     ${i + 1}. ${user.id} (${user.name})`);
            });
        }
    } catch (error) {
        console.log(`   ❌ Users error: ${error.message}`);
    }
    
    // 4. Test user-specific graph visualization
    console.log('\n4. 🎯 Testing user-specific graph visualization...');
    try {
        const userGraphResponse = await makeRequest('/context/graph/visualization?userId=alice');
        console.log(`   Status: ${userGraphResponse.status}`);
        console.log(`   Alice's Nodes: ${userGraphResponse.data.nodes?.length || 0}`);
        console.log(`   Alice's Edges: ${userGraphResponse.data.edges?.length || 0}`);
    } catch (error) {
        console.log(`   ❌ User graph error: ${error.message}`);
    }
    
    // 5. Test insights
    console.log('\n5. 💡 Testing insights endpoint...');
    try {
        const insightsResponse = await makeRequest('/context/graph/insights/alice');
        console.log(`   Status: ${insightsResponse.status}`);
        console.log(`   Insights: ${insightsResponse.data?.length || 0}`);
        
        if (insightsResponse.data?.length > 0) {
            console.log('   📋 Sample insights:');
            insightsResponse.data.slice(0, 3).forEach((insight, i) => {
                console.log(`     ${i + 1}. ${insight.category}: ${insight.description}`);
            });
        }
    } catch (error) {
        console.log(`   ❌ Insights error: ${error.message}`);
    }
    
    console.log('\n✅ Graph visualization endpoint tests completed!');
    console.log('\n🌐 Frontend URLs:');
    console.log(`   Chat Interface: ${BASE_URL}/`);
    console.log(`   Graph Visualization: ${BASE_URL}/graph.html`);
}

testGraphVisualization().catch(console.error);
