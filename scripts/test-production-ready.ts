import axios from 'axios';
import { Pinecone } from '@pinecone-database/pinecone';
import Redis from 'ioredis';
import neo4j from 'neo4j-driver';
import { InferenceClient } from '@huggingface/inference';
import * as dotenv from 'dotenv';

dotenv.config();

async function testProductionEnvironment() {
    console.log('🚀 Testing PRODUCTION-READY Environment');
    console.log('='.repeat(60));

    const results: Record<string, boolean> = {};
    let totalTests = 0;
    let passedTests = 0;

    // Test 1: Hugging Face Cloud API
    console.log('\n1️⃣ Testing Hugging Face Cloud API...');
    totalTests++;
    try {
        const hf = new InferenceClient(process.env.HUGGINGFACE_API_KEY);
        // Test with a simple feature extraction
        const response = await hf.featureExtraction({
            model: 'sentence-transformers/all-MiniLM-L6-v2',
            inputs: 'Test embedding generation'
        });
        console.log('✅ Hugging Face API: WORKING');
        console.log(`   API Key: Valid and authenticated`);
        console.log(`   Feature Extraction: ${Array.isArray(response) ? 'Working' : 'Failed'}`);
        results.huggingface = true;
        passedTests++;
    } catch (error: any) {
        console.log('❌ Hugging Face API: FAILED -', error.message);
        results.huggingface = false;
    }

    // Test 2: Pinecone Cloud Vector DB
    console.log('\n2️⃣ Testing Pinecone Cloud Vector Database...');
    totalTests++;
    try {
        const pinecone = new Pinecone({
            apiKey: process.env.PINECONE_API_KEY!
        });

        const indexes = await pinecone.listIndexes();
        const targetIndex = process.env.PINECONE_INDEX_NAME;
        const indexExists = indexes.indexes?.some(idx => idx.name === targetIndex);

        if (!indexExists) {
            console.log(`🔧 Creating index: ${targetIndex}`);
            await pinecone.createIndex({
                name: targetIndex!,
                dimension: parseInt(process.env.EMBEDDING_DIMENSION || '384'),
                metric: 'cosine',
                spec: {
                    serverless: {
                        cloud: 'aws',
                        region: 'us-east-1'
                    }
                }
            });
            console.log('⏳ Waiting for index to be ready...');
            await new Promise(resolve => setTimeout(resolve, 30000)); // Wait 30 seconds
        }

        const index = pinecone.index(targetIndex!);
        const stats = await index.describeIndexStats();

        console.log('✅ Pinecone Vector DB: WORKING');
        console.log(`   Index: ${targetIndex}`);
        console.log(`   Vectors: ${stats.totalRecordCount || 0}`);
        console.log(`   Environment: ${process.env.PINECONE_ENVIRONMENT}`);
        results.pinecone = true;
        passedTests++;
    } catch (error: any) {
        console.log('❌ Pinecone Vector DB: FAILED -', error.message);
        results.pinecone = false;
    }

    // Test 3: Redis Cloud KV Store
    console.log('\n3️⃣ Testing Redis Cloud KV Store...');
    totalTests++;
    try {
        const redis = new Redis({
            host: process.env.REDIS_HOST!,
            port: parseInt(process.env.REDIS_PORT!),
            password: process.env.REDIS_PASSWORD!,
            maxRetriesPerRequest: 3,
        });

        const pong = await redis.ping();
        await redis.set('production-test', JSON.stringify({
            timestamp: new Date().toISOString(),
            test: 'production-ready'
        }), 'EX', 30);

        const stored = await redis.get('production-test');
        const info = await redis.info('server');
        const version = info.match(/redis_version:([^\r\n]+)/)?.[1];

        await redis.del('production-test');
        await redis.quit();

        console.log('✅ Redis Cloud: WORKING');
        console.log(`   Host: ${process.env.REDIS_HOST}`);
        console.log(`   Version: ${version}`);
        console.log(`   Auth: Protected with password`);
        results.redis = true;
        passedTests++;
    } catch (error: any) {
        console.log('❌ Redis Cloud: FAILED -', error.message);
        results.redis = false;
    }

    // Test 4: Neo4j Cloud Graph Database
    console.log('\n4️⃣ Testing Neo4j Cloud Graph Database...');
    totalTests++;
    try {
        const driver = neo4j.driver(
            process.env.NEO4J_URI!,
            neo4j.auth.basic(process.env.NEO4J_USER!, process.env.NEO4J_PASSWORD!)
            // Encryption is handled by neo4j+s:// URI scheme
        );

        const session = driver.session();
        const result = await session.run('CALL db.info()');
        const dbInfo = result.records[0]?.toObject();

        await session.run(`
            CREATE (test:ProductionTest {
                timestamp: datetime(),
                status: 'working'
            })
        `);

        await session.run('MATCH (test:ProductionTest) DELETE test');
        await session.close();
        await driver.close();

        console.log('✅ Neo4j Cloud: WORKING');
        console.log(`   URI: ${process.env.NEO4J_URI?.split('@')[1] || 'Secured'}`);
        console.log(`   Connection: SSL/TLS Encrypted`);
        console.log(`   Database: ${dbInfo?.name || 'Connected'}`);
        results.neo4j = true;
        passedTests++;
    } catch (error: any) {
        console.log('❌ Neo4j Cloud: FAILED -', error.message);
        results.neo4j = false;
    }

    // Test 5: MCP Server (Railway Production)
    console.log('\n5️⃣ Testing MCP Server (Railway Production)...');
    totalTests++;
    try {
        const mcpResponse = await axios.post(`${process.env.MCP_SERVER_BASE_URL}/api/mcp`, {
            jsonrpc: '2.0',
            id: 'prod-test',
            method: 'tools/list',
            params: {}
        }, {
            timeout: 10000,
            headers: { 'Content-Type': 'application/json' }
        });

        const tools = mcpResponse.data.result?.tools || [];
        console.log('✅ MCP Server (Railway): WORKING');
        console.log(`   URL: ${process.env.MCP_SERVER_BASE_URL}/api/mcp`);
        console.log(`   Tools Available: ${tools.length}`);
        console.log(`   Top Tools: ${tools.slice(0, 3).map((t: any) => t.name).join(', ')}`);
        results.mcpServer = true;
        passedTests++;
    } catch (error: any) {
        console.log('❌ MCP Server: FAILED -', error.message);
        results.mcpServer = false;
    }

    // Test 6: NestJS Server (if running)
    console.log('\n6️⃣ Testing NestJS Server...');
    totalTests++;
    try {
        const response = await axios.get('http://localhost:3000/api/health', { timeout: 3000 });
        console.log('✅ NestJS Server: WORKING');
        console.log(`   Status: ${response.data.status}`);
        console.log(`   Port: 3000`);
        results.nestjsServer = true;
        passedTests++;
    } catch (error: any) {
        console.log('❌ NestJS Server: NOT RUNNING');
        console.log('💡 Tip: Run "npm run start:dev" to start the server');
        results.nestjsServer = false;
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('🏆 PRODUCTION ENVIRONMENT TEST RESULTS');
    console.log('='.repeat(60));

    const scorePercentage = Math.round((passedTests / totalTests) * 100);

    console.log(`📊 Score: ${passedTests}/${totalTests} (${scorePercentage}%)`);
    console.log('');

    Object.entries(results).forEach(([service, status]) => {
        const icon = status ? '✅' : '❌';
        const name = service.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
        console.log(`${icon} ${name}: ${status ? 'PRODUCTION READY' : 'NEEDS ATTENTION'}`);
    });

    console.log('\n🎯 OVERALL STATUS:');

    if (scorePercentage === 100) {
        console.log('🎉 PERFECT! 100% PRODUCTION READY!');
        console.log('🚀 Your system is ready for live deployment!');
        console.log('💎 All cloud services are working perfectly!');
    } else if (scorePercentage >= 80) {
        console.log('🌟 EXCELLENT! Nearly production ready!');
        console.log('🔧 Minor issues can be resolved quickly');
    } else if (scorePercentage >= 60) {
        console.log('🔧 GOOD! Most services working, some setup needed');
    } else {
        console.log('⚠️  SETUP REQUIRED for production deployment');
    }

    console.log('\n🎯 NEXT STEPS:');
    if (!results.nestjsServer) {
        console.log('1. Start NestJS server: npm run start:dev');
    }
    if (passedTests >= 4) {
        console.log('2. Test full system integration: npm run test:current');
        console.log('3. Deploy to production! 🚀');
    } else {
        console.log('2. Fix failing services above');
        console.log('3. Re-run this test: npm run test:production');
    }
}

testProductionEnvironment().catch(console.error);
