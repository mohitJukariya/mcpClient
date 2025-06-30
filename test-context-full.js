// Test script to populate context data and test graph
const http = require('http');

async function makeRequest(path, method = 'GET', data = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 3000,
            path: path,
            method: method,
            headers: {
                'Content-Type': 'application/json'
            }
        };

        const req = http.request(options, (res) => {
            let responseData = '';
            
            res.on('data', (chunk) => {
                responseData += chunk;
            });
            
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(responseData);
                    resolve({ status: res.statusCode, data: parsed });
                } catch (error) {
                    resolve({ status: res.statusCode, data: responseData });
                }
            });
        });

        req.on('error', reject);
        
        if (data) {
            req.write(JSON.stringify(data));
        }
        
        req.end();
    });
}

async function testContextSystem() {
    console.log('🧪 Testing Context System...\n');

    // 1. First, let's make some chat requests to generate context data
    console.log('1. 📝 Generating context data with chat requests...');
    
    const chatRequests = [
        { message: "what is the current gas price", personalityId: "alice" },
        { message: "balance of 0x742d35Cc6634C0532925a3b8D0A81C3e02e40890", personalityId: "alice" },
        { message: "gas optimization tips", personalityId: "alice" }
    ];

    for (const [index, chatRequest] of chatRequests.entries()) {
        console.log(`   Making chat request ${index + 1}: "${chatRequest.message}"`);
        try {
            const response = await makeRequest('/chat', 'POST', chatRequest);
            console.log(`   ✅ Response status: ${response.status}`);
            if (response.data.toolsUsed) {
                console.log(`   🛠️  Tools used: ${response.data.toolsUsed.length}`);
            }
        } catch (error) {
            console.log(`   ❌ Error: ${error.message}`);
        }
        
        // Wait between requests
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('\n2. 📊 Checking context graph...');
    
    // 2. Check graph visualization
    try {
        const graphResponse = await makeRequest('/context/graph/visualization?userId=alice');
        console.log(`   Graph status: ${graphResponse.status}`);
        console.log(`   Nodes: ${graphResponse.data.nodes?.length || 0}`);
        console.log(`   Edges: ${graphResponse.data.edges?.length || 0}`);
        
        if (graphResponse.data.nodes?.length > 0) {
            console.log('\n   📋 NODES FOUND:');
            graphResponse.data.nodes.forEach((node, i) => {
                console.log(`   ${i + 1}. ${node.label} (${node.type})`);
            });
            
            console.log('\n   🔗 EDGES FOUND:');
            graphResponse.data.edges?.forEach((edge, i) => {
                console.log(`   ${i + 1}. ${edge.label}: ${edge.from} -> ${edge.to}`);
            });
        } else {
            console.log('   ❌ NO CONTEXT DATA FOUND!');
            console.log('   🔍 This explains why you see the old graph structure.');
            console.log('   💡 The chat requests may not be storing context properly.');
        }
        
    } catch (error) {
        console.log(`   ❌ Graph error: ${error.message}`);
    }

    console.log('\n3. 📈 Checking context insights...');
    
    // 3. Check context insights
    try {
        const insightsResponse = await makeRequest('/context/graph/insights/alice');
        console.log(`   Insights status: ${insightsResponse.status}`);
        console.log(`   Top tools: ${insightsResponse.data.topTools?.length || 0}`);
        console.log(`   Recommendations: ${insightsResponse.data.recommendations?.length || 0}`);
        
        if (insightsResponse.data.topTools?.length > 0) {
            console.log('\n   🛠️  TOP TOOLS:');
            insightsResponse.data.topTools.forEach((tool, i) => {
                console.log(`   ${i + 1}. ${tool.tool} (used ${tool.usage} times)`);
            });
        }
        
    } catch (error) {
        console.log(`   ❌ Insights error: ${error.message}`);
    }

    console.log('\n4. 📊 Checking graph stats...');
    
    // 4. Check graph stats
    try {
        const statsResponse = await makeRequest('/context/graph/stats');
        console.log(`   Stats status: ${statsResponse.status}`);
        console.log(`   Total nodes: ${statsResponse.data.totalNodes || 0}`);
        console.log(`   Total relationships: ${statsResponse.data.totalRelationships || 0}`);
        
        if (statsResponse.data.nodesByType) {
            console.log('\n   📋 NODES BY TYPE:');
            Object.entries(statsResponse.data.nodesByType).forEach(([type, count]) => {
                console.log(`   ${type}: ${count}`);
            });
        }
        
    } catch (error) {
        console.log(`   ❌ Stats error: ${error.message}`);
    }
}

testContextSystem().catch(console.error);
