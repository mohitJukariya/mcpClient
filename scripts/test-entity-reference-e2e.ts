import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { ChatService } from '../src/chat/chat.service';
import { KVCacheService } from '../src/cache/kv-cache.service';

async function testEntityReferenceEndToEnd() {
    const app = await NestFactory.createApplicationContext(AppModule);
    const chatService = app.get(ChatService);
    const kvCacheService = app.get(KVCacheService);

    console.log('🧪 TESTING ENTITY REFERENCE END-TO-END');
    console.log('======================================');

    const conversationId = 'test-entity-e2e-conv';
    const userId = 'test-user';
    const personalityId = 'alice';

    try {
        // Test 1: First message with address - should create entity reference
        console.log('\n1. Testing first message with address...');
        const firstMessage = 'Check the balance of 0x5616CAABa92cdf656E7d1bA36Fe1bd878E51c174';

        const firstResponse = await chatService.processMessage(
            firstMessage,
            conversationId,
            userId,
            personalityId
        );

        console.log('First response:', firstResponse);

        // Check if entity references were created
        const cacheAfterFirst = await kvCacheService.getConversationCache(conversationId);
        console.log('Entity references after first message:', cacheAfterFirst?.tokenOptimization?.entityReferences);

        // Test 2: Second message using short reference - should resolve correctly
        console.log('\n2. Testing second message with potential short reference...');
        const secondMessage = 'What about the balance of that address?';

        const secondResponse = await chatService.processMessage(
            secondMessage,
            conversationId,
            userId,
            personalityId
        );

        console.log('Second response:', secondResponse);

        // Test 3: Direct reference query
        console.log('\n3. Testing direct reference query...');
        const directMessage = 'Check balance of addr1';

        const directResponse = await chatService.processMessage(
            directMessage,
            conversationId,
            userId,
            personalityId
        );

        console.log('Direct response:', directResponse);

        // Check final cache state
        const finalCache = await kvCacheService.getConversationCache(conversationId);
        console.log('\nFinal cache state:');
        console.log('- Active addresses:', finalCache?.activeAddresses);
        console.log('- Entity references:', finalCache?.tokenOptimization?.entityReferences);
        console.log('- Turn count:', finalCache?.turnCount);

        // Test 4: Multiple addresses
        console.log('\n4. Testing multiple addresses...');
        const multiMessage = 'Also check 0x1234567890123456789012345678901234567890 and 0x0987654321098765432109876543210987654321';

        const multiResponse = await chatService.processMessage(
            multiMessage,
            conversationId,
            userId,
            personalityId
        );

        console.log('Multi-address response:', multiResponse);

        const finalCacheMulti = await kvCacheService.getConversationCache(conversationId);
        console.log('\nFinal cache state with multiple addresses:');
        console.log('- Active addresses:', finalCacheMulti?.activeAddresses);
        console.log('- Entity references:', finalCacheMulti?.tokenOptimization?.entityReferences);

    } catch (error) {
        console.error('❌ Error during end-to-end test:', error);
    }

    await app.close();
}

testEntityReferenceEndToEnd().catch(console.error);
