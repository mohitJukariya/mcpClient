// Test script to check context graph API response
const http = require('http');

const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/context/graph/insights/alice',
    method: 'GET',
    headers: {
        'Content-Type': 'application/json'
    }
};

console.log('🧪 Testing Context Graph API...');
console.log('📡 GET /context/graph/insights/alice');

const req = http.request(options, (res) => {
    console.log(`📊 Status Code: ${res.statusCode}`);
    
    let data = '';
    
    res.on('data', (chunk) => {
        data += chunk;
    });
    
    res.on('end', () => {
        try {
            const response = JSON.parse(data);
            
            console.log('\n🔍 RESPONSE ANALYSIS:');
            console.log('Response keys:', Object.keys(response));
            console.log('Nodes count:', response.nodes?.length || 0);
            console.log('Edges count:', response.edges?.length || 0);
            
            if (response.nodes && response.nodes.length > 0) {
                console.log('\n📋 NODES:');
                response.nodes.forEach((node, i) => {
                    console.log(`${i + 1}. ${node.label} (${node.type}) - ${node.id}`);
                });
                
                console.log('\n🔗 EDGES:');
                response.edges?.forEach((edge, i) => {
                    console.log(`${i + 1}. ${edge.from} -> ${edge.to} (${edge.type})`);
                });
            } else {
                console.log('❌ NO NODES FOUND - This is why you see old data!');
            }
            
            console.log('\n📊 METADATA:');
            console.log(JSON.stringify(response.metadata, null, 2));
            
        } catch (error) {
            console.log('❌ JSON Parse Error:', error.message);
            console.log('Raw response:', data);
        }
    });
});

req.on('error', (error) => {
    if (error.code === 'ECONNREFUSED') {
        console.log('❌ Cannot connect to server.');
        console.log('💡 Make sure server is running: npm run start:dev');
    } else {
        console.log('❌ Request error:', error.message);
    }
});

req.setTimeout(10000);
req.end();
