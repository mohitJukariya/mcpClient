import { ConfigService } from '@nestjs/config';
import { LlmService } from '../src/llm/llm.service';
import { KVCacheService } from '../src/cache/kv-cache.service';
import * as dotenv from 'dotenv';

dotenv.config();

// Mock ConfigService for testing
class MockConfigService {
    get(key: string): string | undefined {
        return process.env[key];
    }
}

// Mock KVCacheService for testing
class MockKVCacheService {
    async getOptimizedPromptContext(): Promise<any> {
        return null; // No cache context for testing
    }

    async storeToolResult(): Promise<void> {
        // Mock implementation
    }

    async initializeConversationCache(): Promise<any> {
        // Mock implementation
        return {};
    }

    async getCachedToolResult(): Promise<any> {
        return null; // No cached results for testing
    }
}

async function testLlmService() {
    console.log('🧠 Testing LLM Service...');

    const configService = new MockConfigService() as any;
    const kvCacheService = new MockKVCacheService() as any;
    const llmService = new LlmService(configService, kvCacheService);

    try {
        console.log('\n1️⃣ Testing basic chat response...');
        const response = await llmService.generateResponse([
            {
                role: 'user',
                content: 'What is Arbitrum and why is it important for Ethereum scaling?'
            }
        ]);

        console.log('✅ LLM Service working!');
        console.log('📝 Response:', response.content);
        console.log('🔧 Tool calls:', response.toolCalls?.length || 0);

        console.log('\n2️⃣ Testing with tools...');
        const responseWithTools = await llmService.generateResponse([
            {
                role: 'user',
                content: 'Get the current ETH price on Arbitrum'
            }
        ], [
            {
                name: 'get_token_price',
                description: 'Get current price of a token',
                input_schema: {
                    type: 'object',
                    properties: {
                        token: { type: 'string' },
                        network: { type: 'string' }
                    }
                }
            }
        ]);

        console.log('✅ LLM Service with tools working!');
        console.log('📝 Response:', responseWithTools.content);
        console.log('🔧 Tool calls:', responseWithTools.toolCalls?.length || 0);

        return true;
    } catch (error) {
        console.error('❌ LLM Service test failed:', error.message);
        return false;
    }
}

testLlmService()
    .then(success => {
        if (success) {
            console.log('\n🎉 All LLM Service tests passed!');
            process.exit(0);
        } else {
            console.log('\n💥 Some tests failed');
            process.exit(1);
        }
    })
    .catch(error => {
        console.error('💥 Test execution failed:', error);
        process.exit(1);
    });
