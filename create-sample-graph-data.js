const http = require('http');

function makeRequest(path, method = 'GET', data = null) {
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
          resolve({
            status: res.statusCode,
            data: JSON.parse(responseData)
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            data: responseData
          });
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

async function createSampleData() {
  console.log('🏗️ Creating sample context data...\n');

  try {
    // 1. Send some chat messages to create graph data
    const testMessages = [
      {
        message: "What's the balance of 0x742d35Cc6634C0532925a3b8D0A81C3e02e40890?",
        personalityId: "alice"
      },
      {
        message: "Get gas price",
        personalityId: "alice" 
      },
      {
        message: "Show me transaction history for 0x742d35Cc6634C0532925a3b8D0A81C3e02e40890",
        personalityId: "bob"
      }
    ];

    for (const testMsg of testMessages) {
      console.log(`📤 Sending: "${testMsg.message}" (as ${testMsg.personalityId})`);
      try {
        const response = await makeRequest('/api/chat', 'POST', testMsg);
        console.log(`✅ Response status: ${response.status}`);
        if (response.data?.toolsUsed) {
          console.log(`🔧 Tools used: ${response.data.toolsUsed.map(t => t.name).join(', ')}`);
        }
      } catch (error) {
        console.log(`❌ Error: ${error.message}`);
      }
      console.log('');
      
      // Wait a bit between requests
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // 2. Now check the graph data
    console.log('🔍 Checking graph data after creating sample interactions...\n');

    // Check stats
    try {
      const statsResponse = await makeRequest('/api/context/graph/stats');
      console.log('📊 Graph Stats:', JSON.stringify(statsResponse.data, null, 2));
    } catch (error) {
      console.log('❌ Error getting stats:', error.message);
    }

    // Check visualization
    try {
      const graphResponse = await makeRequest('/api/context/graph/visualization');
      console.log('\n🌐 Graph Visualization:');
      console.log(`Nodes: ${graphResponse.data.nodes?.length || 0}`);
      console.log(`Edges: ${graphResponse.data.edges?.length || 0}`);
      
      if (graphResponse.data.nodes?.length > 0) {
        console.log('\nSample nodes:');
        graphResponse.data.nodes.slice(0, 5).forEach(node => {
          console.log(`  - ${node.type}: ${node.label} (ID: ${node.id})`);
        });
      }
      
      if (graphResponse.data.edges?.length > 0) {
        console.log('\nSample edges:');
        graphResponse.data.edges.slice(0, 5).forEach(edge => {
          console.log(`  - ${edge.from} -[${edge.label}]-> ${edge.to}`);
        });
      }
    } catch (error) {
      console.log('❌ Error getting visualization:', error.message);
    }

    // Check Alice's insights
    try {
      const insightsResponse = await makeRequest('/api/context/graph/insights/alice');
      console.log('\n💡 Alice\'s Insights:', JSON.stringify(insightsResponse.data, null, 2));
    } catch (error) {
      console.log('❌ Error getting insights:', error.message);
    }

  } catch (error) {
    console.error('❌ Error creating sample data:', error.message);
  }
}

createSampleData();
