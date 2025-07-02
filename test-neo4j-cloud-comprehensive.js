/**
 * Neo4j Cloud Connection Test Script
 * Tests connection to production Neo4j Cloud instance
 */

const neo4j = require('neo4j-driver');
require('dotenv').config();

// Use credentials from .env file
const NEO4J_URI = process.env.NEO4J_URI || 'neo4j+s://f539314c.databases.neo4j.io';
const NEO4J_USER = process.env.NEO4J_USER || 'neo4j';
const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD || 'VPpE3NdCOMXx6qV5DeIkT86__QrsxAGugvlBbIbhXXo';

console.log('🔗 NEO4J CLOUD CONNECTION TEST');
console.log('==============================');
console.log('URI:', NEO4J_URI);
console.log('User:', NEO4J_USER);
console.log('Password:', NEO4J_PASSWORD.substring(0, 10) + '...');
console.log('');

const driver = neo4j.driver(
    NEO4J_URI,
    neo4j.auth.basic(NEO4J_USER, NEO4J_PASSWORD)
);

async function testNeo4jCloudConnection() {
    const session = driver.session();
    
    try {
        console.log('📡 Step 1: Testing basic connection...');
        
        // Test 1: Basic connection
        const basicResult = await session.run('RETURN "Hello from Neo4j Cloud!" as message, datetime() as timestamp');
        const message = basicResult.records[0].get('message');
        const timestamp = basicResult.records[0].get('timestamp').toString();
        
        console.log('✅ Basic connection successful!');
        console.log('   Message:', message);
        console.log('   Timestamp:', timestamp);
        console.log('');
        
        // Test 2: Database info
        console.log('📊 Step 2: Getting database information...');
        const dbInfo = await session.run('CALL db.info() YIELD *');
        if (dbInfo.records.length > 0) {
            console.log('✅ Database info retrieved:');
            dbInfo.records[0].keys.forEach(key => {
                const value = dbInfo.records[0].get(key);
                console.log(`   ${key}: ${value}`);
            });
        }
        console.log('');
        
        // Test 3: Create test node
        console.log('🏗️  Step 3: Creating test node...');
        const createResult = await session.run(
            'CREATE (n:TestNode {name: $name, created: datetime(), testId: $testId}) RETURN n',
            { 
                name: 'Neo4j Cloud Connection Test',
                testId: Date.now().toString()
            }
        );
        
        const createdNode = createResult.records[0].get('n');
        console.log('✅ Test node created successfully!');
        console.log('   Node ID:', createdNode.identity.toString());
        console.log('   Node properties:', createdNode.properties);
        console.log('');
        
        // Test 4: Query test node
        console.log('🔍 Step 4: Querying test node...');
        const queryResult = await session.run(
            'MATCH (n:TestNode {name: $name}) RETURN n, id(n) as nodeId',
            { name: 'Neo4j Cloud Connection Test' }
        );
        
        console.log('✅ Test node query successful!');
        console.log(`   Found ${queryResult.records.length} test node(s)`);
        queryResult.records.forEach((record, index) => {
            const node = record.get('n');
            const nodeId = record.get('nodeId').toString();
            console.log(`   Node ${index + 1}: ID=${nodeId}, Name=${node.properties.name}`);
        });
        console.log('');
        
        // Test 5: Test relationship creation
        console.log('🔗 Step 5: Testing relationship creation...');
        await session.run(`
            MATCH (n:TestNode {name: $name})
            CREATE (n)-[:TESTED_BY]->(t:TestResult {
                result: 'SUCCESS',
                timestamp: datetime(),
                details: 'Neo4j Cloud connection test passed'
            })
            RETURN n, t
        `, { name: 'Neo4j Cloud Connection Test' });
        
        console.log('✅ Test relationship created successfully!');
        console.log('');
        
        // Test 6: Complex query test
        console.log('🧩 Step 6: Testing complex query...');
        const complexResult = await session.run(`
            MATCH (n:TestNode)-[r:TESTED_BY]->(t:TestResult)
            WHERE n.name = $name
            RETURN n.name as nodeName, 
                   type(r) as relationshipType, 
                   t.result as testResult,
                   t.details as details
        `, { name: 'Neo4j Cloud Connection Test' });
        
        console.log('✅ Complex query successful!');
        complexResult.records.forEach(record => {
            console.log('   Node Name:', record.get('nodeName'));
            console.log('   Relationship:', record.get('relationshipType'));
            console.log('   Test Result:', record.get('testResult'));
            console.log('   Details:', record.get('details'));
        });
        console.log('');
        
        // Test 7: Performance test
        console.log('⚡ Step 7: Performance test...');
        const startTime = Date.now();
        
        await Promise.all([
            session.run('RETURN rand() as random1'),
            session.run('RETURN rand() as random2'),
            session.run('RETURN rand() as random3'),
            session.run('RETURN rand() as random4'),
            session.run('RETURN rand() as random5')
        ]);
        
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        console.log('✅ Performance test completed!');
        console.log(`   5 concurrent queries executed in ${duration}ms`);
        console.log(`   Average: ${(duration/5).toFixed(2)}ms per query`);
        console.log('');
        
        // Test 8: Cleanup
        console.log('🧹 Step 8: Cleaning up test data...');
        const deleteResult = await session.run(`
            MATCH (n:TestNode {name: $name})
            OPTIONAL MATCH (n)-[r]->(t:TestResult)
            DELETE n, r, t
            RETURN count(n) as deletedNodes
        `, { name: 'Neo4j Cloud Connection Test' });
        
        const deletedCount = deleteResult.records[0].get('deletedNodes').toString();
        console.log('✅ Cleanup completed!');
        console.log(`   Deleted ${deletedCount} test nodes and relationships`);
        console.log('');
        
        // Final summary
        console.log('🎉 ALL TESTS PASSED!');
        console.log('========================');
        console.log('✅ Basic connection: SUCCESS');
        console.log('✅ Database info: SUCCESS');
        console.log('✅ Node creation: SUCCESS');
        console.log('✅ Node querying: SUCCESS');
        console.log('✅ Relationship creation: SUCCESS');
        console.log('✅ Complex queries: SUCCESS');
        console.log('✅ Performance: SUCCESS');
        console.log('✅ Data cleanup: SUCCESS');
        console.log('');
        console.log('🚀 Neo4j Cloud is ready for production use!');
        console.log('🔗 Your application can safely connect to this database.');
        
    } catch (error) {
        console.error('❌ Neo4j Cloud connection test FAILED!');
        console.error('');
        console.error('Error type:', error.constructor.name);
        console.error('Error message:', error.message);
        console.error('');
        
        if (error.code) {
            console.error('Error code:', error.code);
        }
        
        if (error.message.includes('authentication')) {
            console.error('🔐 Authentication Error:');
            console.error('   - Check username and password in .env file');
            console.error('   - Verify Neo4j Cloud credentials');
        } else if (error.message.includes('connection')) {
            console.error('🌐 Connection Error:');
            console.error('   - Check internet connection');
            console.error('   - Verify Neo4j Cloud URI');
            console.error('   - Check firewall settings');
        } else if (error.message.includes('timeout')) {
            console.error('⏱️  Timeout Error:');
            console.error('   - Network latency too high');
            console.error('   - Try again in a few moments');
        }
        
        console.error('');
        console.error('Full error details:', error);
        
    } finally {
        await session.close();
        await driver.close();
        console.log('');
        console.log('🔌 Connection closed.');
    }
}

// Handle script termination
process.on('SIGINT', async () => {
    console.log('\n🛑 Test interrupted. Closing connection...');
    await driver.close();
    process.exit(0);
});

process.on('unhandledRejection', async (error) => {
    console.error('❌ Unhandled error:', error);
    await driver.close();
    process.exit(1);
});

// Run the test
testNeo4jCloudConnection();
