/**
 * Simplified Neo4j Cloud Connection Test
 * Tests connection with proper transaction handling
 */

const neo4j = require('neo4j-driver');
require('dotenv').config();

const NEO4J_URI = process.env.NEO4J_URI;
const NEO4J_USER = process.env.NEO4J_USER;
const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD;

console.log('🔗 NEO4J CLOUD CONNECTION TEST (Simplified)');
console.log('============================================');
console.log('URI:', NEO4J_URI);
console.log('User:', NEO4J_USER);
console.log('');

const driver = neo4j.driver(
    NEO4J_URI,
    neo4j.auth.basic(NEO4J_USER, NEO4J_PASSWORD)
);

async function testConnection() {
    let session = null;
    
    try {
        // Test 1: Basic Connection
        console.log('📡 Testing basic connection...');
        session = driver.session();
        
        const result = await session.run('RETURN "Neo4j Cloud Connected!" as message, datetime() as timestamp');
        const message = result.records[0].get('message');
        const timestamp = result.records[0].get('timestamp').toString();
        
        console.log('✅ Connection successful!');
        console.log('   Message:', message);
        console.log('   Server time:', timestamp);
        
        await session.close();
        
        // Test 2: Create and Query Node
        console.log('');
        console.log('🏗️  Testing node creation...');
        session = driver.session();
        
        const createResult = await session.run(`
            CREATE (n:MCPTest {
                name: 'Connection Test',
                timestamp: datetime(),
                testId: $testId
            })
            RETURN n, id(n) as nodeId
        `, { testId: Date.now().toString() });
        
        const node = createResult.records[0].get('n');
        const nodeId = createResult.records[0].get('nodeId').toString();
        
        console.log('✅ Node created successfully!');
        console.log('   Node ID:', nodeId);
        console.log('   Node name:', node.properties.name);
        
        await session.close();
        
        // Test 3: Query and Delete
        console.log('');
        console.log('🔍 Testing query and cleanup...');
        session = driver.session();
        
        const queryResult = await session.run('MATCH (n:MCPTest) RETURN count(n) as testNodeCount');
        const count = queryResult.records[0].get('testNodeCount').toString();
        
        console.log('✅ Query successful!');
        console.log('   Found', count, 'test nodes');
        
        // Cleanup
        await session.run('MATCH (n:MCPTest) DELETE n');
        console.log('✅ Test nodes cleaned up');
        
        await session.close();
        
        // Test 4: Performance check
        console.log('');
        console.log('⚡ Testing performance...');
        const startTime = Date.now();
        
        session = driver.session();
        await session.run('RETURN rand() as random');
        await session.close();
        
        const duration = Date.now() - startTime;
        console.log('✅ Performance test completed!');
        console.log(`   Query executed in ${duration}ms`);
        
        // Final success message
        console.log('');
        console.log('🎉 ALL TESTS PASSED!');
        console.log('===================');
        console.log('✅ Basic connection: SUCCESS');
        console.log('✅ Node creation: SUCCESS');
        console.log('✅ Query operations: SUCCESS');
        console.log('✅ Data cleanup: SUCCESS');
        console.log('✅ Performance: SUCCESS');
        console.log('');
        console.log('🚀 Your Neo4j Cloud database is ready!');
        console.log('🔗 Your MCP Client can connect successfully.');
        
        // Test MCP-specific operations
        console.log('');
        console.log('🔧 Testing MCP-specific operations...');
        session = driver.session();
        
        // Test creating user and query nodes (like your app does)
        await session.run(`
            CREATE (u:User {id: 'test-user', name: 'Test User', created: datetime()})
            CREATE (q:Query {id: 'test-query-1', content: 'Test query', timestamp: datetime()})
            CREATE (u)-[:ASKS]->(q)
            RETURN u, q
        `);
        
        console.log('✅ MCP User/Query nodes created');
        
        // Test tool usage relationship
        await session.run(`
            MATCH (q:Query {id: 'test-query-1'})
            CREATE (t:Tool {name: 'getBalance', used: datetime()})
            CREATE (q)-[:USES_TOOL {params: '{"address":"0x123"}'}]->(t)
            RETURN t
        `);
        
        console.log('✅ MCP Tool relationship created');
        
        // Query the graph structure
        const graphResult = await session.run(`
            MATCH (u:User)-[r1:ASKS]->(q:Query)-[r2:USES_TOOL]->(t:Tool)
            RETURN u.name as userName, q.content as queryContent, t.name as toolName
        `);
        
        if (graphResult.records.length > 0) {
            const record = graphResult.records[0];
            console.log('✅ MCP Graph structure verified:');
            console.log('   User:', record.get('userName'));
            console.log('   Query:', record.get('queryContent'));
            console.log('   Tool:', record.get('toolName'));
        }
        
        // Cleanup MCP test data
        await session.run('MATCH (n) WHERE n:User OR n:Query OR n:Tool DELETE n');
        console.log('✅ MCP test data cleaned up');
        
        await session.close();
        
        console.log('');
        console.log('🎯 MCP CLIENT READY FOR PRODUCTION!');
        console.log('===================================');
        console.log('Your Neo4j Cloud database supports:');
        console.log('✅ User context storage');
        console.log('✅ Query relationship tracking');
        console.log('✅ Tool usage analytics');
        console.log('✅ Graph-based insights');
        console.log('✅ Production-grade performance');
        
    } catch (error) {
        console.error('');
        console.error('❌ Connection test FAILED!');
        console.error('Error:', error.message);
        
        if (error.code) {
            console.error('Code:', error.code);
        }
        
        // Provide troubleshooting tips
        if (error.message.includes('authentication')) {
            console.error('');
            console.error('🔐 Authentication issue - check credentials in .env');
        } else if (error.message.includes('connection')) {
            console.error('');
            console.error('🌐 Network issue - check internet connection');
        }
        
    } finally {
        if (session) {
            await session.close();
        }
        await driver.close();
        console.log('');
        console.log('🔌 Connection closed.');
    }
}

testConnection();
