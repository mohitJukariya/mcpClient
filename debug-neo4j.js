const neo4j = require('neo4j-driver');
require('dotenv').config();

// Neo4j connection configuration
const NEO4J_URI = process.env.NEO4J_URI;
const NEO4J_USER = process.env.NEO4J_USER;
const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD;

console.log('🔗 Connecting to Neo4j...');
console.log('URI:', NEO4J_URI);
console.log('User:', NEO4J_USER);

const driver = neo4j.driver(NEO4J_URI, neo4j.auth.basic(NEO4J_USER, NEO4J_PASSWORD));

async function debugNeo4j() {
    const session = driver.session();
    
    try {
        console.log('\n=== NEO4J DATABASE DEBUG SCRIPT ===\n');
        
        // 1. Check database connection
        console.log('1. 🔍 Testing database connection...');
        const connectionTest = await session.run('RETURN "Connection successful" as message');
        console.log('✅ Connection:', connectionTest.records[0].get('message'));
        
        // 2. Get database info
        console.log('\n2. 📊 Database information...');
        const dbInfo = await session.run('CALL db.info()');
        if (dbInfo.records.length > 0) {
            console.log('Database info:', dbInfo.records[0].toObject());
        }
        
        // 3. Count all nodes by label
        console.log('\n3. 📈 Node counts by label...');
        const allLabels = await session.run('CALL db.labels()');
        console.log('Available labels:', allLabels.records.map(r => r.get('label')));
        
        for (const record of allLabels.records) {
            const label = record.get('label');
            const countResult = await session.run(`MATCH (n:\`${label}\`) RETURN count(n) as count`);
            const count = countResult.records[0].get('count').toNumber();
            console.log(`${label}: ${count} nodes`);
        }
        
        // 4. Count all relationships by type
        console.log('\n4. 🔗 Relationship counts by type...');
        const allRelTypes = await session.run('CALL db.relationshipTypes()');
        console.log('Available relationship types:', allRelTypes.records.map(r => r.get('relationshipType')));
        
        for (const record of allRelTypes.records) {
            const relType = record.get('relationshipType');
            const countResult = await session.run(`MATCH ()-[r:\`${relType}\`]-() RETURN count(r) as count`);
            const count = countResult.records[0].get('count').toNumber();
            console.log(`${relType}: ${count} relationships`);
        }
        
        // 5. Get sample of all nodes (first 20)
        console.log('\n5. 📋 Sample nodes (first 20)...');
        const sampleNodes = await session.run(`
            MATCH (n)
            RETURN labels(n) as labels, 
                   properties(n) as properties,
                   id(n) as nodeId
            LIMIT 20
        `);
        
        sampleNodes.records.forEach((record, index) => {
            const labels = record.get('labels');
            const properties = record.get('properties');
            const nodeId = record.get('nodeId').toNumber();
            console.log(`Node ${index + 1}: [${labels.join(':')}] ID:${nodeId}`);
            console.log('  Properties:', JSON.stringify(properties, null, 2));
        });
        
        // 6. Get sample of all relationships (first 20)
        console.log('\n6. 🔗 Sample relationships (first 20)...');
        const sampleRels = await session.run(`
            MATCH (a)-[r]->(b)
            RETURN labels(a) as sourceLabels,
                   properties(a) as sourceProps,
                   type(r) as relType,
                   properties(r) as relProps,
                   labels(b) as targetLabels,
                   properties(b) as targetProps,
                   id(r) as relId
            LIMIT 20
        `);
        
        sampleRels.records.forEach((record, index) => {
            const sourceLabels = record.get('sourceLabels');
            const sourceProps = record.get('sourceProps');
            const relType = record.get('relType');
            const relProps = record.get('relProps');
            const targetLabels = record.get('targetLabels');
            const targetProps = record.get('targetProps');
            const relId = record.get('relId').toNumber();
            
            console.log(`Relationship ${index + 1}: ID:${relId}`);
            console.log(`  [${sourceLabels.join(':')}] -[${relType}]-> [${targetLabels.join(':')}]`);
            console.log(`  Source: ${JSON.stringify(sourceProps)}`);
            console.log(`  Relationship: ${JSON.stringify(relProps)}`);
            console.log(`  Target: ${JSON.stringify(targetProps)}`);
            console.log('  ---');
        });
        
        // 7. Get specific blockchain-related data
        console.log('\n7. 🔍 Blockchain-specific data...');
        
        // Users
        const users = await session.run('MATCH (u:User) RETURN u LIMIT 10');
        console.log(`\nUsers (${users.records.length}):`);
        users.records.forEach(record => {
            const user = record.get('u').properties;
            console.log(`  - ${user.userId || user.id}: ${user.name || 'No name'}`);
        });
        
        // Queries
        const queries = await session.run('MATCH (q:Query) RETURN q LIMIT 10');
        console.log(`\nQueries (${queries.records.length}):`);
        queries.records.forEach(record => {
            const query = record.get('q').properties;
            console.log(`  - ${query.queryId}: ${query.content ? query.content.substring(0, 50) + '...' : 'No content'}`);
        });
        
        // Addresses
        const addresses = await session.run('MATCH (a:Address) RETURN a LIMIT 10');
        console.log(`\nAddresses (${addresses.records.length}):`);
        addresses.records.forEach(record => {
            const address = record.get('a').properties;
            console.log(`  - ${address.address}: ${address.type || 'unknown type'}`);
        });
        
        // Tools
        const tools = await session.run('MATCH (t:Tool) RETURN t LIMIT 10');
        console.log(`\nTools (${tools.records.length}):`);
        tools.records.forEach(record => {
            const tool = record.get('t').properties;
            console.log(`  - ${tool.name}: ${tool.description || 'No description'}`);
        });
        
        // 8. Check for recent activity (last 24 hours)
        console.log('\n8. ⏰ Recent activity (last 24 hours)...');
        const recentActivity = await session.run(`
            MATCH (n)
            WHERE n.createdAt > datetime() - duration('P1D')
            RETURN labels(n) as labels, count(n) as count
            ORDER BY count DESC
        `);
        
        console.log('Recent nodes created:');
        recentActivity.records.forEach(record => {
            const labels = record.get('labels');
            const count = record.get('count').toNumber();
            console.log(`  ${labels.join(':')}: ${count} nodes`);
        });
        
        // 9. Get visualization data structure
        console.log('\n9. 📊 Graph structure for visualization...');
        const graphData = await session.run(`
            MATCH (n)-[r]->(m)
            RETURN {
                nodes: collect(DISTINCT {
                    id: id(n),
                    labels: labels(n),
                    properties: properties(n)
                }) + collect(DISTINCT {
                    id: id(m),
                    labels: labels(m),
                    properties: properties(m)
                }),
                relationships: collect({
                    id: id(r),
                    type: type(r),
                    source: id(n),
                    target: id(m),
                    properties: properties(r)
                })
            } as graphStructure
            LIMIT 1
        `);
        
        if (graphData.records.length > 0) {
            const structure = graphData.records[0].get('graphStructure');
            console.log(`Total unique nodes in sample: ${structure.nodes ? structure.nodes.length : 0}`);
            console.log(`Total relationships in sample: ${structure.relationships ? structure.relationships.length : 0}`);
        }
        
        console.log('\n=== DEBUG COMPLETE ===');
        
    } catch (error) {
        console.error('❌ Error during debug:', error);
        console.error('Error details:', error.message);
    } finally {
        await session.close();
    }
}

async function main() {
    try {
        await debugNeo4j();
    } catch (error) {
        console.error('❌ Script failed:', error);
    } finally {
        await driver.close();
        console.log('\n🔌 Database connection closed.');
    }
}

// Run the script
main().catch(console.error);
