const neo4j = require('neo4j-driver');
require('dotenv').config();

const NEO4J_URI = process.env.NEO4J_URI;
const NEO4J_USER = process.env.NEO4J_USER;
const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD;

const driver = neo4j.driver(NEO4J_URI, neo4j.auth.basic(NEO4J_USER, NEO4J_PASSWORD));

async function analyzeRelationships() {
    const session = driver.session();
    
    try {
        console.log('🔍 Analyzing which queries have tool/insight/address relationships...\n');
        
        // Check which queries have tool relationships
        console.log('📋 Queries with USED_TOOL relationships:');
        const toolQueries = await session.run(`
            MATCH (q:Query)-[:USED_TOOL]->(t:Tool)
            RETURN q.id as queryId, q.content as content, t.name as toolName
        `);
        
        toolQueries.records.forEach(record => {
            console.log(`  Query: ${record.get('queryId')} -> Tool: ${record.get('toolName')}`);
            console.log(`    Content: ${record.get('content')?.substring(0, 60)}...`);
        });
        
        // Check which queries have insight relationships
        console.log('\n🧠 Queries with GENERATED_INSIGHT relationships:');
        const insightQueries = await session.run(`
            MATCH (q:Query)-[:GENERATED_INSIGHT]->(i:Insight)
            RETURN q.id as queryId, q.content as content, i.content as insightContent
        `);
        
        insightQueries.records.forEach(record => {
            console.log(`  Query: ${record.get('queryId')} -> Insight content`);
            console.log(`    Query: ${record.get('content')?.substring(0, 60)}...`);
            console.log(`    Insight: ${record.get('insightContent')?.substring(0, 60)}...`);
        });
        
        // Check which queries have address relationships
        console.log('\n🏠 Queries with INVOLVES_ADDRESS relationships:');
        const addressQueries = await session.run(`
            MATCH (q:Query)-[:INVOLVES_ADDRESS]->(a:Address)
            RETURN q.id as queryId, q.content as content, a.address as address
        `);
        
        addressQueries.records.forEach(record => {
            console.log(`  Query: ${record.get('queryId')} -> Address: ${record.get('address')}`);
            console.log(`    Content: ${record.get('content')?.substring(0, 60)}...`);
        });
        
        // Now check if these queries are connected to users
        console.log('\n🔗 Checking if these queries are connected to users:');
        
        const userConnectedQueries = await session.run(`
            MATCH (u:User)-[:QUERIES]->(q:Query)
            RETURN q.id as queryId
        `);
        
        const userQueryIds = new Set(userConnectedQueries.records.map(r => r.get('queryId')));
        console.log(`Total queries connected to users: ${userQueryIds.size}`);
        
        // Check tool queries
        const toolQueryIds = toolQueries.records.map(r => r.get('queryId'));
        const toolQueriesConnectedToUsers = toolQueryIds.filter(id => userQueryIds.has(id));
        console.log(`Tool queries connected to users: ${toolQueriesConnectedToUsers.length}/${toolQueryIds.length}`);
        
        // Check insight queries  
        const insightQueryIds = insightQueries.records.map(r => r.get('queryId'));
        const insightQueriesConnectedToUsers = insightQueryIds.filter(id => userQueryIds.has(id));
        console.log(`Insight queries connected to users: ${insightQueriesConnectedToUsers.length}/${insightQueryIds.length}`);
        
        // Check address queries
        const addressQueryIds = addressQueries.records.map(r => r.get('queryId'));
        const addressQueriesConnectedToUsers = addressQueryIds.filter(id => userQueryIds.has(id));
        console.log(`Address queries connected to users: ${addressQueriesConnectedToUsers.length}/${addressQueryIds.length}`);
        
        // Show disconnected queries
        console.log('\n❌ Queries with relationships but NOT connected to users:');
        const allRelatedQueryIds = [...new Set([...toolQueryIds, ...insightQueryIds, ...addressQueryIds])];
        const disconnectedQueries = allRelatedQueryIds.filter(id => !userQueryIds.has(id));
        
        if (disconnectedQueries.length > 0) {
            for (const queryId of disconnectedQueries) {
                const queryInfo = await session.run(`
                    MATCH (q:Query {id: $queryId})
                    RETURN q.content as content
                `, { queryId });
                
                if (queryInfo.records.length > 0) {
                    console.log(`  ${queryId}: ${queryInfo.records[0].get('content')?.substring(0, 60)}...`);
                }
            }
        } else {
            console.log('  None - all queries with relationships are connected to users!');
        }

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await session.close();
        await driver.close();
    }
}

analyzeRelationships().catch(console.error);
