// Quick test to verify context graph generation
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

async function testContextGraphFix() {
    console.log('🧪 Testing Context Graph Fix...\n');

    // 1. Clear any existing data and make fresh chat requests
    console.log('1. 🗣️  Making chat requests with Alice...');
    
    const testRequests = [
        { message: "what is the current gas price on arbitrum", personalityId: "alice" },
        { message: "check balance of 0x742d35Cc6634C0532925a3b8D0A81C3e02e40890", personalityId: "alice" }
    ];

    for (const [index, request] of testRequests.entries()) {
        console.log(`   Request ${index + 1}: "${request.message}"`);
        try {
            const response = await makeRequest('/chat', 'POST', request);
            console.log(`   Status: ${response.status}`);
            if (response.data.toolsUsed?.length > 0) {
                console.log(`   ✅ Tools used: ${response.data.toolsUsed.map(t => t.name).join(', ')}`);
            } else {
                console.log(`   ❌ No tools used`);
            }
        } catch (error) {
            console.log(`   ❌ Error: ${error.message}`);
        }
        
        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log('\n2. 📊 Checking context graph...');
    
    // 2. Check if graph now has data
    try {
        const graphResponse = await makeRequest('/context/graph/visualization?userId=alice');
        console.log(`Status: ${graphResponse.status}`);
        console.log(`Nodes: ${graphResponse.data.nodes?.length || 0}`);
        console.log(`Edges: ${graphResponse.data.edges?.length || 0}`);
        
        if (graphResponse.data.nodes?.length > 0) {
            console.log('\n🎉 SUCCESS! Context graph now has data:');
            console.log('\n📋 NODES:');
            graphResponse.data.nodes.forEach((node, i) => {
                console.log(`   ${i + 1}. ${node.label} (${node.type}) - Size: ${node.size}`);
            });
            
            if (graphResponse.data.edges?.length > 0) {
                console.log('\n🔗 RELATIONSHIPS:');
                graphResponse.data.edges.forEach((edge, i) => {
                    console.log(`   ${i + 1}. ${edge.label}: ${edge.from} -> ${edge.to}`);
                });
            }
            
            console.log('\n✅ The graph should now show proper user context relationships!');
            console.log('   - Alice (User) at the center');
            console.log('   - Query nodes for each question asked');
            console.log('   - Tool nodes connected to queries');
            console.log('   - Insight nodes with generated learnings');
            
        } else {
            console.log('\n❌ Still no context data. Possible issues:');
            console.log('   - Neo4j not connected properly');
            console.log('   - Graph creation methods failing');
            console.log('   - User ID not being passed correctly');
        }
        
    } catch (error) {
        console.log(`❌ Graph error: ${error.message}`);
    }

    console.log('\n3. 📈 Checking detailed insights...');
    
    try {
        const insightsResponse = await makeRequest('/context/graph/insights/alice');
        console.log(`Status: ${insightsResponse.status}`);
        
        if (insightsResponse.data.topTools?.length > 0) {
            console.log('\n🛠️  ALICE\'S TOP TOOLS:');
            insightsResponse.data.topTools.forEach((tool, i) => {
                console.log(`   ${i + 1}. ${tool.tool} (used ${tool.usage} times)`);
            });
        }
        
        if (insightsResponse.data.recommendations?.length > 0) {
            console.log('\n💡 RECOMMENDATIONS:');
            insightsResponse.data.recommendations.forEach((rec, i) => {
                console.log(`   ${i + 1}. ${rec}`);
            });
        }
        
    } catch (error) {
        console.log(`❌ Insights error: ${error.message}`);
    }
}

testContextGraphFix().catch(console.error);
