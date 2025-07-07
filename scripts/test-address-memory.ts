/**
 * Address Memory Persistence Test Script
 * Tests if the system can remember addresses across multiple queries
 */

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { ContextStorageService } from '../src/context/context-storage.service';
import { EmbeddingsService } from '../src/embeddings/embeddings.service';
import { ContextController } from '../src/context/context.controller';
import { ChatController } from '../src/chat/chat.controller';
import { Logger } from '@nestjs/common';

const logger = new Logger('AddressMemoryTest');

async function testAddressMemoryPersistence() {
    console.log('🧠 Starting Address Memory Persistence Test...\n');

    try {
        // Initialize the NestJS application
        const app = await NestFactory.createApplicationContext(AppModule);
        const contextStorage = app.get(ContextStorageService);
        const embeddingsService = app.get(EmbeddingsService);
        const contextController = app.get(ContextController);
        const chatController = app.get(ChatController);

        // Wait for services to initialize
        console.log('⏳ Waiting for services to initialize...');
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Clear database for clean test
        console.log('🧹 Clearing database for clean test...');
        await contextStorage.clearDatabase();

        const testAddress = '0x4A94b0eb099C12Fad3dDFaDf3A73E661D2587e74';
        const testUser = 'alice';
        const sessionId = `session_${Date.now()}`;

        // Test 1: Initial query - Store address in memory
        console.log('📝 Test 1: Storing address in memory...');

        const initialQuery = {
            message: `Please remember this address: ${testAddress}. I want to monitor this wallet.`,
            userId: testUser,
            sessionId: sessionId
        };

        try {
            const response1 = await chatController.chat(initialQuery);
            console.log('✅ Initial response:', {
                hasResponse: !!response1.response,
                contentLength: response1.response?.length || 0,
                sessionId: response1.sessionId,
                toolsUsed: response1.toolsUsed?.length || 0
            });

            // Store context explicitly
            await contextController.addUserContext(testUser, {
                query: `Remember address ${testAddress} for monitoring`,
                toolsUsed: [],
                addressesInvolved: [testAddress],
                insights: [{
                    content: `User wants to monitor address ${testAddress}`,
                    confidence: 0.9
                }],
                metadata: {
                    sessionId: sessionId,
                    timestamp: new Date().toISOString(),
                    confidence: 0.9,
                    personality: testUser
                }
            });

            console.log('✅ Address stored in context storage');
        } catch (error) {
            console.log('❌ Initial query failed:', error.message);
        }

        // Test 2: Second query - Different topic
        console.log('\n📝 Test 2: Asking about different topic...');

        const query2 = {
            message: 'What is the current gas price on Arbitrum?',
            userId: testUser,
            sessionId: sessionId
        };

        try {
            const response2 = await chatController.chat(query2);
            console.log('✅ Second query response:', {
                hasResponse: !!response2.response,
                contentLength: response2.response?.length || 0,
                toolsUsed: response2.toolsUsed?.length || 0
            });
        } catch (error) {
            console.log('❌ Second query failed:', error.message);
        }

        // Test 3: Third query - Another different topic
        console.log('\n📝 Test 3: Asking about another topic...');

        const query3 = {
            message: 'Tell me about the latest block information',
            userId: testUser,
            sessionId: sessionId
        };

        try {
            const response3 = await chatController.chat(query3);
            console.log('✅ Third query response:', {
                hasResponse: !!response3.response,
                contentLength: response3.response?.length || 0,
                toolsUsed: response3.toolsUsed?.length || 0
            });
        } catch (error) {
            console.log('❌ Third query failed:', error.message);
        }

        // Test 4: Check if address can be retrieved from embeddings
        console.log('\n📝 Test 4: Testing embedding-based address retrieval...');

        try {
            const searchResults = await embeddingsService.searchSimilarMessages(
                `address ${testAddress} monitor wallet`,
                sessionId,
                5,
                0.6
            );

            console.log('✅ Embedding search results:', {
                count: searchResults?.length || 0,
                foundAddress: searchResults?.some(r => r.content?.includes(testAddress)) || false,
                results: searchResults?.map(r => ({
                    score: r.score,
                    hasAddress: r.content?.includes(testAddress),
                    content: r.content?.substring(0, 100) + '...'
                })) || []
            });
        } catch (error) {
            console.log('❌ Embedding search failed:', error.message);
        }

        // Test 5: Fourth query - Try to recall the address
        console.log('\n📝 Test 5: Asking to recall the stored address...');

        const query4 = {
            message: 'What was the address I asked you to remember earlier?',
            userId: testUser,
            sessionId: sessionId
        };

        try {
            const response4 = await chatController.chat(query4);
            console.log('✅ Address recall response:', {
                hasResponse: !!response4.response,
                contentLength: response4.response?.length || 0,
                containsAddress: response4.response?.includes(testAddress) || false,
                response: response4.response
            });

            if (response4.response?.includes(testAddress)) {
                console.log('🎉 SUCCESS: System remembered the address!');
            } else {
                console.log('❌ FAILURE: System failed to remember the address');
            }
        } catch (error) {
            console.log('❌ Address recall query failed:', error.message);
        }

        // Test 6: Fifth query - Ask for action on the address
        console.log('\n📝 Test 6: Asking for action on the stored address...');

        const query5 = {
            message: 'Check the balance of the address I asked you to monitor',
            userId: testUser,
            sessionId: sessionId
        };

        try {
            const response5 = await chatController.chat(query5);
            console.log('✅ Address action response:', {
                hasResponse: !!response5.response,
                contentLength: response5.response?.length || 0,
                containsAddress: response5.response?.includes(testAddress) || false,
                hasToolCall: response5.toolsUsed?.length > 0 || false,
                toolCalls: response5.toolsUsed?.map(tc => tc.name) || [],
                response: response5.response
            });

            if (response5.toolsUsed?.some(tc => tc.name === 'getBalance' && JSON.stringify(tc.arguments).includes(testAddress))) {
                console.log('🎉 SUCCESS: System used the remembered address for action!');
            } else {
                console.log('❌ FAILURE: System failed to use the remembered address for action');
            }
        } catch (error) {
            console.log('❌ Address action query failed:', error.message);
        }

        // Test 7: Check what's actually stored in the system
        console.log('\n📝 Test 7: Checking what\'s stored in the system...');

        try {
            // Check embeddings storage
            const allEmbeddings = await embeddingsService.searchSimilarMessages(
                'address wallet monitor',
                sessionId,
                10,
                0.3
            );

            console.log('📊 All stored embeddings:', {
                totalCount: allEmbeddings?.length || 0,
                withAddress: allEmbeddings?.filter(e => e.content?.includes(testAddress)).length || 0,
                samples: allEmbeddings?.slice(0, 3).map(e => ({
                    score: e.score,
                    content: e.content?.substring(0, 100) + '...'
                })) || []
            });

            // Check context storage by looking at user data
            const allUsers = await contextController.getAllUsers();
            const testUserData = allUsers.find(u => u.id === testUser);
            console.log('📊 User contexts:', {
                userExists: !!testUserData,
                totalContexts: testUserData?.contextHistory?.length || 0,
                withTestAddress: testUserData?.contextHistory?.filter(c =>
                    c.metadata?.addressesInvolved?.includes(testAddress) ||
                    c.content?.includes(testAddress)
                ).length || 0
            });

        } catch (error) {
            console.log('❌ System storage check failed:', error.message);
        }

        console.log('\n🎯 Test Summary:');
        console.log('================');
        console.log(`Test Address: ${testAddress}`);
        console.log(`Session ID: ${sessionId}`);
        console.log(`User ID: ${testUser}`);

        console.log('\n🎉 Address Memory Persistence Test Complete!');
        await app.close();

    } catch (error) {
        console.error('\n❌ Address Memory Test Failed:', error);
        console.error('Stack trace:', error.stack);
        process.exit(1);
    }
}

// Run the test
testAddressMemoryPersistence().catch(console.error);
