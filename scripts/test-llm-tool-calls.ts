import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { LlmService } from '../src/llm/llm.service';

async function testLLMToolCalls() {
    console.log('🧪 Testing LLM Tool Call Generation');

    const app = await NestFactory.createApplicationContext(AppModule);
    const llmService = app.get(LlmService);

    // Test tools
    const tools = [
        {
            name: 'getBalance',
            description: 'Get the ETH balance of an address',
            input_schema: {
                type: 'object',
                properties: {
                    address: {
                        type: 'string',
                        description: 'The Ethereum address to check'
                    }
                },
                required: ['address']
            }
        }
    ];

    const conversationHistory = [
        { role: 'user' as const, content: 'fetch the eth balance of this address 0x5616CAABa92cdf656E7d1bA36Fe1bd878E51c174' }
    ];

    try {
        console.log('🔮 Generating LLM response...');
        const response = await llmService.generateResponse(
            conversationHistory,
            tools,
            'test-session-001',
            'alice'
        );

        console.log('✅ LLM Response:', response);
        console.log('📊 Tool calls found:', response.toolCalls?.length || 0);

        if (response.toolCalls && response.toolCalls.length > 0) {
            console.log('🔧 Tool calls details:');
            response.toolCalls.forEach((call, index) => {
                console.log(`  ${index + 1}. ${call.name}:`, call.arguments);
            });
        } else {
            console.log('❌ No tool calls found in response');
            console.log('💬 Raw content:', response.content);
        }

    } catch (error) {
        console.error('❌ Error testing LLM:', error);
    }

    await app.close();
}

testLLMToolCalls().catch(console.error);
