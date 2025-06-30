const http = require('http');

function makeRequest(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: 'GET'
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(data);
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.end();
  });
}

async function testGraphData() {
  try {
    console.log('🔍 Testing graph API endpoints...\n');

    // Test graph stats
    console.log('📊 Graph Stats:');
    try {
      const stats = await makeRequest('/api/context/graph/stats');
      console.log(JSON.stringify(stats, null, 2));
    } catch (error) {
      console.log('Error getting stats:', error.message);
    }
    console.log('');

    // Test graph visualization
    console.log('🌐 Graph Visualization (no user filter):');
    try {
      const allGraph = await makeRequest('/api/context/graph/visualization');
      console.log('Node count:', allGraph.nodes?.length || 0);
      console.log('Edge count:', allGraph.edges?.length || 0);
      console.log('Metadata:', JSON.stringify(allGraph.metadata, null, 2));      
      if (allGraph.nodes?.length > 0) {
        console.log('\nSample nodes:');
        allGraph.nodes.slice(0, 3).forEach(node => {
          console.log(`  - ${node.type}: ${node.label} (${node.id})`);
        });
      }
      
      if (allGraph.edges?.length > 0) {
        console.log('\nSample edges:');
        allGraph.edges.slice(0, 3).forEach(edge => {
          console.log(`  - ${edge.from} -[${edge.type}]-> ${edge.to}`);
        });
      }
    } catch (error) {
      console.log('Error getting graph visualization:', error.message);
    }
    console.log('');

    // Test users
    console.log('👥 Available Users:');
    try {
      const users = await makeRequest('/api/context/users');
      console.log(JSON.stringify(users, null, 2));
      console.log('');

      // Test with specific user (if any users exist)
      if (users && users.length > 0) {
        const userId = users[0].id;
        console.log(`🎯 Graph for user: ${userId}`);
        try {
          const userGraph = await makeRequest(`/api/context/graph/visualization?userId=${userId}`);
          console.log('Node count:', userGraph.nodes?.length || 0);
          console.log('Edge count:', userGraph.edges?.length || 0);

          console.log(`💡 Insights for user: ${userId}`);
          const insights = await makeRequest(`/api/context/graph/insights/${userId}`);
          console.log('User profile:', insights.userProfile);
          console.log('Top tools:', insights.topTools);
          console.log('Recommendations:', insights.recommendations);
        } catch (error) {
          console.log('Error getting user-specific data:', error.message);
        }
      }
    } catch (error) {
      console.log('Error getting users:', error.message);
    }

  } catch (error) {
    console.error('❌ Error testing graph:', error.message);
  }
}

testGraphData();
