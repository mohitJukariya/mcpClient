import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { LlmService } from '../src/llm/llm.service';

async function testEntityReferenceFix() {
  console.log('🧪 Testing Entity Reference Resolution Fix');

  try {
    const app = await NestFactory.createApplicationContext(AppModule);
    const llmService = app.get(LlmService);

    // Simulate the problematic scenario
    const toolCalls = [
      {
        name: 'getBalance',
        arguments: {
          address: '0xC7d62e8dfD78d2270382414d6c7323F6c54542c6'
        }
      }
    ];

    // Simulate the entity references that were causing the problem
    const entityReferences = {
      'addr1': '0x5616CAABa92cdf656E7d1bA36Fe1bd878E51c174',
      'addr2': '0xC7d62e8dfD78d2270382414d6c7323F6c54542c6'
    };

    console.log('🔧 Original tool calls:', JSON.stringify(toolCalls, null, 2));
    console.log('🔧 Entity references:', JSON.stringify(entityReferences, null, 2));

    // Use reflection to access the private method
    const resolveEntityReferencesSync = (llmService as any).resolveEntityReferencesSync.bind(llmService);
    const resolvedToolCalls = resolveEntityReferencesSync(toolCalls, entityReferences);

    console.log('✨ Resolved tool calls:', JSON.stringify(resolvedToolCalls, null, 2));

    // Check if the fix worked
    const resolvedAddress = resolvedToolCalls[0].arguments.address;
    if (resolvedAddress === '0xC7d62e8dfD78d2270382414d6c7323F6c54542c6') {
      console.log('✅ SUCCESS: Address was NOT converted to reference (correct behavior)');
      console.log(`✅ Address remains: ${resolvedAddress}`);
    } else if (resolvedAddress === 'addr2') {
      console.log('❌ FAILURE: Address was still converted to reference');
      console.log(`❌ Address became: ${resolvedAddress}`);
    } else {
      console.log('🤔 UNEXPECTED: Address was changed to something else');
      console.log(`🤔 Address became: ${resolvedAddress}`);
    }

    await app.close();

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

testEntityReferenceFix().catch(console.error);
