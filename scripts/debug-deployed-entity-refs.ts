import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { KVCacheService } from '../src/cache/kv-cache.service';
import { LlmService } from '../src/llm/llm.service';

async function debugDeployedEntityRefs() {
    const app = await NestFactory.createApplicationContext(AppModule);
    const kvCacheService = app.get(KVCacheService);
    const llmService = app.get(LlmService);

    console.log('🔍 DEBUGGING DEPLOYED ENTITY REFERENCE ISSUE');
    console.log('==========================================');

    // Test conversation ID - use a realistic one
    const conversationId = 'test-entity-debug-conv';

    try {
        // 1. Check if we can get conversation cache
        console.log('\n1. Checking conversation cache...');
        const cacheData = await kvCacheService.getConversationCache(conversationId);
        console.log('Cache data:', cacheData);

        // 2. Check entity references in cache
        console.log('\n2. Checking entity references in cache...');
        if (cacheData?.tokenOptimization?.entityReferences) {
            console.log('Entity references found:', cacheData.tokenOptimization.entityReferences);
        } else {
            console.log('❌ No entity references found in cache');
        }

        // 3. Test entity reference creation
        console.log('\n3. Testing entity reference creation...');
        const testAddress = '0x5616CAABa92cdf656E7d1bA36Fe1bd878E51c174';

        // Initialize cache with entity references
        await kvCacheService.initializeConversationCache(
            conversationId,
            'test-user',
            'alice',
            `Check balance of ${testAddress}`
        );

        // Update with entity references - manually add address to cache
        const cacheWithAddress = await kvCacheService.getConversationCache(conversationId);
        if (cacheWithAddress) {
            cacheWithAddress.activeAddresses = [testAddress];
            await kvCacheService.storeConversationCache(cacheWithAddress);
        }

        // Check what was stored
        const updatedCache = await kvCacheService.getConversationCache(conversationId);
        console.log('Updated cache entity references:', updatedCache?.tokenOptimization?.entityReferences);

        // 4. Test tool call resolution
        console.log('\n4. Testing tool call resolution...');
        const testToolCalls = [
            { name: 'getBalance', arguments: { address: 'addr1' } }
        ];

        // Test the private method via reflection
        const resolveEntityReferences = (llmService as any).resolveEntityReferences.bind(llmService);
        const resolvedToolCalls = await resolveEntityReferences(testToolCalls, conversationId);

        console.log('Original tool calls:', testToolCalls);
        console.log('Resolved tool calls:', resolvedToolCalls);

        // 5. Test sync resolution
        console.log('\n5. Testing sync resolution...');
        const entityRefs = updatedCache?.tokenOptimization?.entityReferences || {};
        const resolveEntityReferencesSync = (llmService as any).resolveEntityReferencesSync.bind(llmService);
        const syncResolved = resolveEntityReferencesSync(testToolCalls, entityRefs);

        console.log('Sync resolved tool calls:', syncResolved);

        // 6. Test the specific case from the logs
        console.log('\n6. Testing specific failed case...');
        const failedToolCall = { name: 'getBalance', arguments: { address: 'addr1' } };
        const resolveArgumentReferences = (llmService as any).resolveArgumentReferences.bind(llmService);
        const resolvedArgs = resolveArgumentReferences(failedToolCall.arguments, entityRefs);

        console.log('Failed tool call arguments:', failedToolCall.arguments);
        console.log('Entity references available:', entityRefs);
        console.log('Resolved arguments:', resolvedArgs);

    } catch (error) {
        console.error('❌ Error during debugging:', error);
    }

    await app.close();
}

debugDeployedEntityRefs().catch(console.error);
