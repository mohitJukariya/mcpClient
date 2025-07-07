import { ConfigService } from '@nestjs/config';
import { LlmService } from '../src/llm/llm.service';
import { KVCacheService } from '../src/cache/kv-cache.service';
import { ContextStorageService } from '../src/context/context-storage.service';
import { EmbeddingsService } from '../src/embeddings/embeddings.service';
import { Redis } from 'ioredis';
import * as dotenv from 'dotenv';

dotenv.config();

const mockTools = [
    {
        name: 'getBalance',
        description: 'Get ETH balance for an address',
        input_schema: {
            type: 'object',
            properties: {
                address: {
                    type: 'string',
                    description: 'Ethereum address to check balance for'
                }
            },
            required: ['address']
        }
    },
    {
        name: 'getTokenBalance',
        description: 'Get token balance for an address',
        input_schema: {
            type: 'object',
            properties: {
                contractAddress: { type: 'string', description: 'Token contract address' },
                address: { type: 'string', description: 'Address to check balance for' }
            },
            required: ['contractAddress', 'address']
        }
    }
];

async function testBalanceQuery() {
    console.log('🧪 Testing balance query with improved LLM prompt...');

    const config = new ConfigService();
    const redis = new Redis({
        host: config.get('REDIS_HOST', 'localhost'),
        port: config.get('REDIS_PORT', 6379),
        enableReadyCheck: false,
        maxRetriesPerRequest: 1
    });

    const kvCacheService = new KVCacheService(config);
    const embeddingsService = new EmbeddingsService(config);
    const contextStorageService = new ContextStorageService(config, embeddingsService);
    const llmService = new LlmService(config, kvCacheService);

    // Test queries that should produce tool calls
    const testQueries = [
        {
            query: 'eth balance of 0x5616CAABa92cdf656E7d1bA36Fe1bd878E51c174',
            expected: 'getBalance'
        },
        {
            query: 'what is the balance of 0x5616CAABa92cdf656E7d1bA36Fe1bd878E51c174',
            expected: 'getBalance'
        },
        {
            query: 'check balance for 0x5616CAABa92cdf656E7d1bA36Fe1bd878E51c174',
            expected: 'getBalance'
        },
        {
            query: 'balance of address 0x5616CAABa92cdf656E7d1bA36Fe1bd878E51c174',
            expected: 'getBalance'
        }
    ];

    console.log('📋 Testing with tools:', mockTools.map(t => t.name));

    for (const testCase of testQueries) {
        console.log(`\n🔍 Testing query: "${testCase.query}"`);

        try {
            const messages = [
                { role: 'user' as const, content: testCase.query }
            ];

            const response = await llmService.generateResponse(messages, mockTools);

            console.log('📤 LLM Response:', {
                contentLength: response.content?.length || 0,
                content: response.content,
                toolCallsCount: response.toolCalls?.length || 0,
                toolCalls: response.toolCalls
            });

            // Check if tool call was generated
            if (response.toolCalls && response.toolCalls.length > 0) {
                const toolCall = response.toolCalls[0];
                if (toolCall.name === testCase.expected) {
                    console.log('✅ SUCCESS: Correct tool call generated');

                    // Check if address is properly extracted
                    if (toolCall.arguments.address === '0x5616CAABa92cdf656E7d1bA36Fe1bd878E51c174') {
                        console.log('✅ SUCCESS: Address correctly extracted');
                    } else {
                        console.log('❌ FAILED: Address not correctly extracted:', toolCall.arguments.address);
                    }
                } else {
                    console.log(`❌ FAILED: Wrong tool called. Expected: ${testCase.expected}, Got: ${toolCall.name}`);
                }
            } else {
                console.log('❌ FAILED: No tool calls generated');
                console.log('Response content:', response.content);
            }

        } catch (error) {
            console.error('❌ ERROR:', error.message);
        }
    }

    // Test with Neo4j storage
    console.log('\n🗄️ Testing Neo4j storage with fixed syntax...');

    try {
        await contextStorageService.storeToolUsage('test-context-123', 'getBalance');
        console.log('✅ SUCCESS: Neo4j storage working properly');
    } catch (error) {
        console.error('❌ Neo4j storage error:', error.message);
    }

    // Cleanup
    await redis.quit();
    await contextStorageService.cleanup();

    console.log('\n🏁 Balance query test completed!');
}

testBalanceQuery().catch(console.error);
