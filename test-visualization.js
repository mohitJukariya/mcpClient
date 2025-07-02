const axios = require('axios');

async function testVisualization() {
    try {
        console.log('🔍 Testing graph visualization endpoint...\n');
        
        // Test global visualization
        const globalResponse = await axios.get('http://localhost:3000/api/context/graph/visualization');
        console.log('📊 Global Visualization Results:');
        console.log(`- Total nodes: ${globalResponse.data.nodes.length}`);
        console.log(`- Total edges: ${globalResponse.data.edges.length}`);
        console.log(`- Metadata:`, globalResponse.data.metadata);
        
        // Show sample nodes by type
        const nodesByType = {};
        globalResponse.data.nodes.forEach(node => {
            if (!nodesByType[node.type]) nodesByType[node.type] = [];
            nodesByType[node.type].push(node);
        });
        
        console.log('\n📋 Nodes by type:');
        Object.keys(nodesByType).forEach(type => {
            console.log(`  ${type}: ${nodesByType[type].length} nodes`);
            // Show first 3 examples
            nodesByType[type].slice(0, 3).forEach(node => {
                console.log(`    - ${node.label} (ID: ${node.id})`);
            });
        });
        
        // Show sample edges by type
        const edgesByType = {};
        globalResponse.data.edges.forEach(edge => {
            if (!edgesByType[edge.type]) edgesByType[edge.type] = [];
            edgesByType[edge.type].push(edge);
        });
        
        console.log('\n🔗 Edges by type:');
        Object.keys(edgesByType).forEach(type => {
            console.log(`  ${type}: ${edgesByType[type].length} edges`);
        });
        
        // Test user-specific visualization for Alice
        console.log('\n👩‍💼 Testing user-specific visualization for Alice...');
        const aliceResponse = await axios.get('http://localhost:3000/api/context/graph/visualization?userId=user-001');
        console.log(`- Alice's nodes: ${aliceResponse.data.nodes.length}`);
        console.log(`- Alice's edges: ${aliceResponse.data.edges.length}`);
        console.log(`- Alice's metadata:`, aliceResponse.data.metadata);
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        if (error.response) {
            console.error('Response status:', error.response.status);
            console.error('Response data:', error.response.data);
        }
    }
}

testVisualization();
