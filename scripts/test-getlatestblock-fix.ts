import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { LlmService } from '../src/llm/llm.service';

async function testGetLatestBlockExtraction() {
    console.log('🧪 Testing getLatestBlock Tool Extraction Fix');

    const app = await NestFactory.createApplicationContext(AppModule);
    const llmService = app.get(LlmService);

    // Test the extractToolCalls method directly
    const testContent = 'TOOL_CALL:getLatestBlock:{}';

    // Simulate the tools array that might be incomplete
    const incompleteTools = [
        { name: 'getBalance', description: 'Get ETH balance', input_schema: {} }
        // Note: getLatestBlock is missing from this array
    ];

    console.log('🔧 Testing with incomplete tools array (missing getLatestBlock)');
    console.log('📝 Test content:', testContent);
    console.log('🛠️ Available tools in array:', incompleteTools.map(t => t.name).join(', '));

    // Call the private method using reflection
    const extractMethod = (llmService as any).extractToolCalls.bind(llmService);
    const extractedToolCalls = extractMethod(testContent, incompleteTools);

    console.log('✨ Extracted tool calls:', extractedToolCalls);

    if (extractedToolCalls.length > 0 && extractedToolCalls[0].name === 'getLatestBlock') {
        console.log('✅ SUCCESS: getLatestBlock was extracted despite missing from tools array');
        console.log('🔧 Tool call details:', extractedToolCalls[0]);
    } else {
        console.log('❌ FAILURE: getLatestBlock was not extracted');
    }

    // Test with the complete tools array
    console.log('\n🔧 Testing with complete tools array...');
    const getAllKnownToolsMethod = (llmService as any).getAllKnownBlockchainTools.bind(llmService);
    const completeTools = getAllKnownToolsMethod();

    console.log('🛠️ Complete tools available:', completeTools.length);
    const extractedWithComplete = extractMethod(testContent, completeTools);
    console.log('✨ Extracted with complete tools:', extractedWithComplete);

    await app.close();
}

testGetLatestBlockExtraction().catch(console.error);
