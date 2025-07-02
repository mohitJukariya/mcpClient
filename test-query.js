const neo4j = require('neo4j-driver');
require('dotenv').config();

const NEO4J_URI = process.env.NEO4J_URI;
const NEO4J_USER = process.env.NEO4J_USER;
const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD;

const driver = neo4j.driver(NEO4J_URI, neo4j.auth.basic(NEO4J_USER, NEO4J_PASSWORD));

async function testVisualizationQuery() {
    const session = driver.session();
    
    try {
        console.log('🔍 Testing the exact visualization query...\n');
        
        // This is the exact query used in the global visualization
        const globalContextQuery = `
          MATCH (u:User)-[:QUERIES]->(q:Query)
          OPTIONAL MATCH (q)-[:USED_TOOL]->(t:Tool)
          OPTIONAL MATCH (q)-[:GENERATED_INSIGHT]->(i:Insight)
          OPTIONAL MATCH (q)-[:INVOLVES_ADDRESS]->(a:Address)
          OPTIONAL MATCH (q)-[:RELATED_TO]->(other:Query)
          RETURN u, q, t, i, a, other
          LIMIT 500
        `;

        console.log('🔍 Running global context query...');
        const globalResult = await session.run(globalContextQuery);
        
        console.log(`📊 Query returned ${globalResult.records.length} records\n`);
        
        // Count the different types of nodes found
        let toolCount = 0;
        let insightCount = 0;
        let addressCount = 0;
        let queryCount = 0;
        let userCount = 0;
        
        globalResult.records.forEach((record, index) => {
            if (index < 5) { // Show first 5 records in detail
                console.log(`Record ${index + 1}:`);
                console.log(`  u (User): ${record.get('u') ? JSON.stringify(record.get('u').properties) : 'null'}`);
                console.log(`  q (Query): ${record.get('q') ? record.get('q').properties.content?.substring(0, 50) + '...' : 'null'}`);
                console.log(`  t (Tool): ${record.get('t') ? JSON.stringify(record.get('t').properties) : 'null'}`);
                console.log(`  i (Insight): ${record.get('i') ? JSON.stringify(record.get('i').properties) : 'null'}`);
                console.log(`  a (Address): ${record.get('a') ? JSON.stringify(record.get('a').properties) : 'null'}`);
                console.log(`  other (Query): ${record.get('other') ? record.get('other').properties.content?.substring(0, 30) + '...' : 'null'}`);
                console.log('  ---');
            }
            
            if (record.get('u')) userCount++;
            if (record.get('q')) queryCount++;
            if (record.get('t')) toolCount++;
            if (record.get('i')) insightCount++;
            if (record.get('a')) addressCount++;
        });
        
        console.log(`\n📈 Summary of nodes found in query results:`);
        console.log(`  Users: ${userCount}`);
        console.log(`  Queries: ${queryCount}`);
        console.log(`  Tools: ${toolCount}`);
        console.log(`  Insights: ${insightCount}`);
        console.log(`  Addresses: ${addressCount}`);

        // Let's also test specific relationships
        console.log('\n🔍 Testing specific relationship queries...');
        
        const toolRelQuery = `MATCH (q:Query)-[:USED_TOOL]->(t:Tool) RETURN q, t LIMIT 5`;
        const toolRelResult = await session.run(toolRelQuery);
        console.log(`Tool relationships found: ${toolRelResult.records.length}`);
        
        const insightRelQuery = `MATCH (q:Query)-[:GENERATED_INSIGHT]->(i:Insight) RETURN q, i LIMIT 5`;
        const insightRelResult = await session.run(insightRelQuery);
        console.log(`Insight relationships found: ${insightRelResult.records.length}`);
        
        const addressRelQuery = `MATCH (q:Query)-[:INVOLVES_ADDRESS]->(a:Address) RETURN q, a LIMIT 5`;
        const addressRelResult = await session.run(addressRelQuery);
        console.log(`Address relationships found: ${addressRelResult.records.length}`);

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await session.close();
        await driver.close();
    }
}

testVisualizationQuery().catch(console.error);
