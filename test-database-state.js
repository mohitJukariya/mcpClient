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

async function testDatabaseState() {
  console.log('🔍 Testing database state...\n');

  try {
    // 1. Check storage health
    console.log('📊 Storage Health:');
    const healthResponse = await makeRequest('/api/context/storage/health');
    console.log(JSON.stringify(healthResponse.data, null, 2));
    console.log('');

    // 2. Check if we can query the graph directly
    console.log('🔍 Direct Graph Query (all nodes):');
    const queryResponse = await makeRequest('/api/context/graph/query', 'POST', {
      cypher: 'MATCH (n) RETURN n LIMIT 10',
      parameters: {}
    });
    console.log('Query result:', JSON.stringify(queryResponse.data, null, 2));
    console.log('');

    // 3. Check if we can see relationships
    console.log('🔗 Direct Graph Query (all relationships):');
    const relQueryResponse = await makeRequest('/api/context/graph/query', 'POST', {
      cypher: 'MATCH ()-[r]->() RETURN r LIMIT 10',
      parameters: {}
    });
    console.log('Relationships result:', JSON.stringify(relQueryResponse.data, null, 2));
    console.log('');

    // 4. Send one simple message to create data
    console.log('📤 Sending a simple message to create graph data...');
    const chatResponse = await makeRequest('/api/chat', 'POST', {
      message: "Get gas price",
      personalityId: "alice"
    });
    console.log('Chat response status:', chatResponse.status);
    if (chatResponse.data?.toolsUsed) {
      console.log('Tools used:', chatResponse.data.toolsUsed.map(t => t.name));
    }
    console.log('');

    // 5. Wait a moment and check again
    console.log('⏳ Waiting 3 seconds...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // 6. Check graph again
    console.log('🔍 Checking graph after message...');
    const queryAfterResponse = await makeRequest('/api/context/graph/query', 'POST', {
      cypher: 'MATCH (n) RETURN labels(n) as labels, count(n) as count',
      parameters: {}
    });
    console.log('Node types after message:', JSON.stringify(queryAfterResponse.data, null, 2));

    // 7. Test the visualization endpoint
    console.log('🎨 Testing visualization endpoint...');
    const vizResponse = await makeRequest('/api/context/graph/visualization');
    console.log('Visualization response:');
    console.log('- Status:', vizResponse.status);
    console.log('- Nodes:', vizResponse.data.nodes?.length || 0);
    console.log('- Edges:', vizResponse.data.edges?.length || 0);
    console.log('- Metadata:', JSON.stringify(vizResponse.data.metadata, null, 2));

    if (vizResponse.data.nodes?.length > 0) {
      console.log('\nFirst few nodes:');
      vizResponse.data.nodes.slice(0, 3).forEach(node => {
        console.log(`  - ${node.type}: ${node.label} (${node.id})`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testDatabaseState();
